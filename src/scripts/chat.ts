// DOM wiring for the no-trace chat page. All state comes from startRoom's
// snapshots; this file only renders and forwards user actions.

import {fileTooBig, linkTokens} from '../lib/chat/message';
import {type ChatHandle, type ChatMessage, type Snapshot, startRoom} from '../lib/chat/room';
import {REACTIONS} from '../lib/chat/social';
import {randomName, roomCode} from '../lib/chat/words';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
};

// Same copy path as the calculator: clipboard API first, execCommand fallback.
function copyText(text: string, btn: HTMLButtonElement, label = 'Copy') {
  const done = (ok: boolean) => {
    btn.textContent = ok ? 'Copied' : 'Copy failed';
    setTimeout(() => {
      btn.textContent = label;
    }, 1500);
  };
  navigator.clipboard.writeText(text).then(
    () => done(true),
    () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      done(ok);
    },
  );
}

const fmtSize = (n: number) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

const clock = (ts: number) =>
  new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

export function initChat() {
  const landing = $<HTMLElement>('[data-landing]');
  const roomView = $<HTMLElement>('[data-room]');
  const nameInput = $<HTMLInputElement>('[data-name]');
  const codeInput = $<HTMLInputElement>('[data-code]');
  const createBtn = $<HTMLButtonElement>('[data-create]');
  const joinBtn = $<HTMLButtonElement>('[data-join]');
  const membersList = $<HTMLElement>('[data-members]');
  const requestsBox = $<HTMLElement>('[data-requests]');
  const msgsList = $<HTMLElement>('[data-msgs]');
  const linkOut = $<HTMLElement>('[data-link]');
  const copyLinkBtn = $<HTMLButtonElement>('[data-copy-link]');
  const compose = $<HTMLTextAreaElement>('[data-compose]');
  const composerBox = compose.closest('.composer') as HTMLElement;
  const fileInput = $<HTMLInputElement>('[data-file]');
  const sendBtn = $<HTMLButtonElement>('[data-send]');
  const stagedBox = $<HTMLElement>('[data-staged]');
  const leaveBtn = $<HTMLButtonElement>('[data-leave]');
  const errorBanner = $<HTMLElement>('[data-error]');
  const statusBanner = $<HTMLElement>('[data-status]');
  const landingErr = $<HTMLElement>('[data-error-landing]');

  let handle: ChatHandle | null = null;
  let unsub: (() => void) | null = null;
  let code = '';
  let myName = localStorage.getItem('chat-name') ?? randomName();
  let lastSnap: Snapshot | null = null;
  let stick = true;
  const fileUrls = new Map<string, string>(); // msgId -> object URL, revoked on leave
  let staged: {file: File; url?: string}[] = [];

  nameInput.value = myName;
  codeInput.value = location.hash.slice(1);

  const showError = (text: string) => {
    // Errors go to the banner of the view you are on.
    const err = landing.hidden ? errorBanner : landingErr;
    err.textContent = text;
    err.hidden = false;
  };
  errorBanner.addEventListener('click', () => {
    errorBanner.hidden = true;
  });
  landingErr.addEventListener('click', () => {
    landingErr.hidden = true;
  });

  const setStatus = (text: string | null) => {
    if (text) {
      statusBanner.textContent = text;
      statusBanner.hidden = false;
    } else {
      statusBanner.hidden = true;
    }
  };

  const showLanding = (focus = true) => {
    landing.hidden = false;
    roomView.hidden = true;
    document.body.dataset.chatView = 'landing';
    setStatus(null);
    errorBanner.hidden = true;
    history.replaceState(null, '', location.pathname);
    if (focus) nameInput.focus();
  };

  // Fill the viewport with the panel, whatever chrome sits above it. The
  // banners live inside the panel, so its top in the document never moves.
  const fitRoom = () => {
    if (roomView.hidden) return;
    const top = roomView.getBoundingClientRect().top + window.scrollY;
    roomView.style.height = `${Math.max(300, window.innerHeight - top - 20)}px`;
  };
  window.addEventListener('resize', fitRoom);

  const showRoom = () => {
    landing.hidden = true;
    roomView.hidden = false;
    document.body.dataset.chatView = 'room';
    linkOut.textContent = `${location.origin}/tools/chat/#${code}`;
    fitRoom();
  };

  const start = (create: boolean) => {
    const name = nameInput.value.trim() || randomName();
    myName = name;
    nameInput.value = name;
    localStorage.setItem('chat-name', name);
    if (!create && !codeInput.value.trim()) {
      showError('Enter the room code you were given.');
      return;
    }
    code = create ? roomCode() : codeInput.value.trim().toLowerCase();
    errorBanner.hidden = true;
    landingErr.hidden = true;
    unsub?.();
    handle?.leave();
    handle = startRoom({code, name, create});
    unsub = handle.subscribe(render);
    history.replaceState(null, '', `${location.pathname}#${code}`);
    showRoom();
    compose.focus();
  };

  landing.addEventListener('submit', (e) => {
    e.preventDefault();
    start((e as SubmitEvent).submitter !== joinBtn);
  });
  // Enter inside the code field joins instead of firing the form's default (create).
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      start(false);
    }
  });

  copyLinkBtn.addEventListener('click', () => copyText(linkOut.textContent ?? '', copyLinkBtn));

  leaveBtn.addEventListener('click', async () => {
    await handle?.leave();
    unsub?.();
    unsub = null;
    handle = null;
    lastSnap = null;
    for (const url of fileUrls.values()) URL.revokeObjectURL(url);
    fileUrls.clear();
    for (const s of staged) if (s.url) URL.revokeObjectURL(s.url);
    staged = [];
    renderStaged();
    code = '';
    showLanding();
  });

  const send = () => {
    const raw = compose.value;
    const files = staged.map((s) => s.file);
    if (!raw.trim() && !files.length) return;
    if (raw.trim()) handle?.sendText(raw);
    for (const f of files) handle?.sendFile(f, () => {});
    compose.value = '';
    for (const s of staged) if (s.url) URL.revokeObjectURL(s.url);
    staged = [];
    renderStaged();
    compose.focus();
  };
  sendBtn.addEventListener('click', send);
  compose.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  const renderStaged = () => {
    stagedBox.hidden = staged.length === 0;
    stagedBox.replaceChildren(
      ...staged.map((s, i) => {
        const li = el('li');
        if (s.url) {
          const img = el('img');
          img.src = s.url;
          img.alt = s.file.name;
          li.append(img);
        }
        const nm = el('span', 'nm');
        nm.textContent = s.file.name;
        const drop = el('button', 'drop');
        drop.type = 'button';
        drop.textContent = '×';
        drop.title = 'Remove attachment';
        drop.addEventListener('click', () => {
          if (s.url) URL.revokeObjectURL(s.url);
          staged.splice(i, 1);
          renderStaged();
          compose.focus();
        });
        li.append(nm, drop);
        return li;
      }),
    );
  };

  // Attachments wait in the composer; Enter or Send releases them with the text.
  const stage = (f: File) => {
    if (fileTooBig(f.size)) {
      showError('That is over the 25 MB limit.');
      return;
    }
    staged.push({file: f, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined});
    renderStaged();
  };

  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (!f) return;
    stage(f);
  });

  // An image (or any file) copied elsewhere can be attached with a paste.
  compose.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files ?? [])];
    if (!files.length) return;
    e.preventDefault();
    for (const f of files) stage(f);
  });

  // Owner approvals live behind one delegated listener; rows are rebuilt per flush.
  requestsBox.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    const userId = btn?.getAttribute('data-userid');
    if (!btn || !userId || !handle) return;
    if (btn.hasAttribute('data-accept')) handle.accept(userId);
    else if (btn.hasAttribute('data-decline')) handle.decline(userId);
  });

  msgsList.addEventListener('scroll', () => {
    stick = msgsList.scrollHeight - msgsList.scrollTop - msgsList.clientHeight < 40;
  });

  function render(snap: Snapshot) {
    lastSnap = snap;
    const room = snap.room;

    // Members, owner tagged.
    membersList.replaceChildren(
      ...room.declined
        ? []
        : (room.roster?.members ?? []).map((m) => {
            const li = el('li');
            const b = el('b');
            b.textContent = m.name;
            li.append(b);
            if (room.roster?.ownerId === m.userId) {
              const tag = el('span', 'tag');
              tag.textContent = 'owner';
              li.append(tag);
            }
            return li;
          }),
    );

    // Owner-only approval box.
    const showRequests = snap.role === 'owner' && room.pending.length > 0;
    requestsBox.hidden = !showRequests;
    if (showRequests) {
      const title = el('p', 'req-title');
      title.textContent = 'Asking to join';
      const rows = room.pending.map((p) => {
        const row = el('p', 'req-row');
        const name = el('span', 'name');
        name.textContent = p.name;
        const yes = el('button', 'req-yes');
        yes.type = 'button';
        yes.setAttribute('data-accept', '');
        yes.setAttribute('data-userid', p.userId);
        yes.textContent = 'Accept';
        const no = el('button');
        no.type = 'button';
        no.setAttribute('data-decline', '');
        no.setAttribute('data-userid', p.userId);
        no.textContent = 'Decline';
        row.append(name, yes, no);
        return row;
      });
      requestsBox.replaceChildren(title, ...rows);
    }

    // Status line.
    if (snap.role === 'pending') setStatus('Waiting for the room owner to let you in...');
    else if (snap.role === 'declined') setStatus('The room owner declined.');
    else if (snap.role === 'waiting' || (snap.role === 'owner' && (room.roster?.members.length ?? 0) < 2))
      setStatus('Nobody is here yet. Share the room link; the room exists while at least one person is in it.');
    else setStatus(null);

    // Only members can compose; waiting, pending and declined users read only.
    composerBox.hidden = snap.role !== 'owner' && snap.role !== 'member';

    // Error banner.
    if (snap.error && errorBanner.hidden) showError(snap.error);

    // Messages, oldest last.
    const frag = document.createDocumentFragment();
    for (const m of snap.msgs) frag.append(renderMsg(m));
    msgsList.replaceChildren(frag);
    if (stick) msgsList.scrollTop = msgsList.scrollHeight;
  }

  function renderMsg(m: ChatMessage): HTMLLIElement {
    const li = el('li', 'msg' + (m.mine ? ' mine' : ''));
    const who = el('p', 'who');
    const b = el('b');
    b.textContent = m.fromName;
    const time = el('time');
    time.textContent = clock(m.ts);
    who.append(b, ' ', time);
    li.append(who);

    for (const seg of m.parts ?? []) {
      if (seg.kind === 'text') {
        const bubble = el('div', 'bubble');
        for (const t of linkTokens(seg.text)) {
          if (t.kind === 'word') bubble.append(t.text);
          else {
            const a = el('a');
            a.href = t.text.startsWith('www.') ? `https://${t.text}` : t.text;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = t.text;
            bubble.append(a);
          }
        }
        li.append(bubble);
      } else {
        const wrap = el('div', 'codewrap');
        const pre = el('pre');
        const c = el('code');
        c.textContent = seg.text;
        pre.append(c);
        const copy = el('button', 'copy');
        copy.type = 'button';
        copy.textContent = 'Copy';
        copy.addEventListener('click', () => copyText(seg.text, copy));
        wrap.append(pre, copy);
        li.append(wrap);
      }
    }

    if (m.file) {
      const chip = el('div', 'filechip');
      if (m.file.blob) {
        let url = fileUrls.get(m.id);
        if (!url) {
          url = URL.createObjectURL(m.file.blob);
          fileUrls.set(m.id, url);
        }
        if (m.file.mime.startsWith('image/')) {
          const img = el('img', 'thumb');
          img.src = url;
          img.alt = m.file.name;
          const nm = el('span', 'fname');
          nm.textContent = `${m.file.name} (${fmtSize(m.file.size)})`;
          const a = el('a');
          a.href = url;
          a.download = m.file.name;
          a.append(img, nm);
          chip.append(a);
        } else {
          const a = el('a');
          a.href = url;
          a.download = m.file.name;
          a.textContent = `${m.file.name} (${fmtSize(m.file.size)})`;
          chip.append(a);
        }
      } else {
        const prog = el('progress');
        prog.max = 100;
        prog.value = Math.round((m.file.pct ?? 0) * 100);
        const label = el('span');
        label.textContent = ` ${m.file.name} ${Math.round((m.file.pct ?? 0) * 100)}%`;
        chip.append(prog, label);
      }
      li.append(chip);
    }

    if (m.seenBy.length) {
      const seen = el('p', 'seen');
      seen.textContent = `Seen by ${m.seenBy.join(', ')}`;
      li.append(seen);
    }

    const active = REACTIONS.filter((e) => (m.reactions[e] ?? []).length > 0);
    const bar = el('div', 'reacts');
    for (const emoji of active) {
      const names = m.reactions[emoji] ?? [];
      const chipBtn = el('button');
      chipBtn.type = 'button';
      chipBtn.textContent = `${emoji} ×${names.length}`;
      chipBtn.title = names.join(', ');
      chipBtn.setAttribute('aria-pressed', String(names.includes(myName)));
      chipBtn.addEventListener('click', () => handle?.react(m.id, emoji));
      bar.append(chipBtn);
    }
    const add = el('button', 'add');
    add.type = 'button';
    add.textContent = '+';
    add.title = 'Add reaction';
    add.addEventListener('click', () => bar.classList.toggle('open'));
    const picker = el('span', 'picker');
    for (const emoji of REACTIONS) {
      const pb = el('button');
      pb.type = 'button';
      pb.textContent = emoji;
      pb.addEventListener('click', () => {
        handle?.react(m.id, emoji);
        bar.classList.remove('open');
      });
      picker.append(pb);
    }
    bar.append(add, picker);
    li.append(bar);
    return li;
  }

  showLanding();
}
