// DOM wiring for the no-trace chat page. All state comes from startRoom's
// snapshots; this file only renders and forwards user actions.

import {fileTooBig, linkTokens} from '../lib/chat/message';
import {type ChatHandle, type ChatMessage, type Snapshot, startRoom} from '../lib/chat/room';
import {randomName, roomCode} from '../lib/chat/words';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
};

// Same copy path as the calculator: clipboard API first, execCommand fallback.
// Buttons that carry an icon keep their label in a .lbl span; plain buttons
// are their own label.
function copyText(text: string, btn: HTMLButtonElement, label = 'Copy') {
  const lbl = (btn.querySelector('.lbl') as HTMLElement | null) ?? btn;
  const done = (ok: boolean) => {
    btn.classList.add('copied');
    lbl.textContent = ok ? 'Copied' : 'Copy failed';
    setTimeout(() => {
      btn.classList.remove('copied');
      lbl.textContent = label;
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

// File types the browser itself can display, so an Open button makes sense.
const openable = (mime: string) =>
  /^(image|video|audio)\//.test(mime) || mime === 'application/pdf' || mime.startsWith('text/');

// Safari resets isComposing before the confirming Enter, but keyCode stays 229.
const imeActive = (e: KeyboardEvent) => e.isComposing || e.keyCode === 229;

const extOf = (name: string) => {
  const parts = name.split('.');
  const e = parts.length > 1 ? (parts.pop() ?? '').toUpperCase() : '';
  return /^[A-Z0-9]{1,5}$/.test(e) ? e : 'FILE';
};

// Delivery ticks for own messages: 'one' sent, 'out' received, 'read' seen by
// everyone else. The wire has no per-message ack, so "received" means another
// roster member is currently connected, the closest honest P2P signal.
type TickCtx = {others: number; online: number};
const tickState = (m: ChatMessage, ctx: TickCtx) =>
  !m.mine ? '' : ctx.others > 0 && m.seenBy.length >= ctx.others ? 'read' : ctx.online > 0 ? 'out' : 'one';

const tickSvg = (state: string) =>
  state === 'one'
    ? '<svg viewBox="0 0 15 12" aria-hidden="true"><path d="M1 6.7 4.7 10.2 13.5 1.5"/></svg>'
    : '<svg viewBox="0 0 22 12" aria-hidden="true"><path d="M1 6.7 4.7 10.2 13.5 1.5"/><path d="M8.2 6.7 11.9 10.2 20.7 1.5"/></svg>';

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
  const errorBanner = $<HTMLElement>('[data-error]');
  const statusBanner = $<HTMLElement>('[data-status]');
  const landingErr = $<HTMLElement>('[data-error-landing]');

  let handle: ChatHandle | null = null;
  let unsub: (() => void) | null = null;
  let code = '';
  let myName = localStorage.getItem('chat-name') ?? randomName();
  let stick = true;
  const fileUrls = new Map<string, string>(); // msgId -> object URL, revoked on leave
  let staged: {file: File; url?: string}[] = [];

  nameInput.value = myName;
  codeInput.value = location.hash.slice(1);
  // A join link means joining is the only move.
  if (location.hash.slice(1)) {
    createBtn.hidden = true;
    joinBtn.classList.remove('ghost');
  }

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
    roomView.style.height = `${Math.max(300, window.innerHeight - top - 28)}px`;
  };
  window.addEventListener('resize', fitRoom);
  // Font swaps shift the chrome above the panel; measure again once loaded.
  document.fonts.ready.then(() => fitRoom());

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
    if (e.key !== 'Enter' || imeActive(e)) return;
    e.preventDefault();
    start(false);
  });

  copyLinkBtn.addEventListener('click', () => copyText(linkOut.textContent ?? '', copyLinkBtn, 'Copy link'));

  const send = () => {
    const raw = compose.value;
    const files = staged.map((s) => s.file);
    if (!raw.trim() && !files.length) return;
    // Sending always brings the newest messages into view.
    stick = true;
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
    if (e.key !== 'Enter' || e.shiftKey || imeActive(e)) return;
    e.preventDefault();
    send();
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

  // Dropping files anywhere in the room attaches them like a paste; text
  // drags keep their default behavior.
  roomView.addEventListener('dragover', (e) => {
    if ([...(e.dataTransfer?.types ?? [])].includes('Files')) e.preventDefault();
  });
  roomView.addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer?.files ?? [])];
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

  // Messages are built once and never torn down wholesale: flushes must not
  // restart a video or audio the user is playing. Media state changes replace
  // a message li; social-only changes (receipts) are patched in.
  let renderedRoom = '';

  const socialSig = (m: ChatMessage, ctx: TickCtx) => tickState(m, ctx) + '#' + m.seenBy.join('|');

  const mediaSig = (m: ChatMessage) => (m.file ? `${m.file.pct ?? 1}:${m.file.blob ? 'b' : 'p'}` : '');

  const updateSocial = (li: HTMLLIElement, m: ChatMessage, ctx: TickCtx) => {
    const ticks = li.querySelector('.ticks');
    if (ticks) {
      const state = tickState(m, ctx);
      ticks.className = 'ticks' + (state === 'read' ? ' read' : '');
      ticks.innerHTML = tickSvg(state);
    }
  };

  function render(snap: Snapshot) {
    const room = snap.room;

    // Ticks need the roster context: how many others exist, how many online.
    const memberSet = new Set((room.roster?.members ?? []).map((mm) => mm.userId));
    const ctx: TickCtx = {
      others: Math.max((room.roster?.members.length ?? 0) - 1, 0),
      online: room.connected.filter((id) => memberSet.has(id)).length,
    };

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

    // Messages, oldest last, append-only so playing media is never rebuilt.
    if (renderedRoom !== code) {
      renderedRoom = code;
      msgsList.replaceChildren();
    }
    const kids = [...msgsList.children] as HTMLLIElement[];
    let i = 0;
    for (; i < snap.msgs.length && i < kids.length; i++) {
      const m = snap.msgs[i];
      const li = kids[i];
      if (li.dataset.id !== m.id) {
        // Order broke (new room edge): rebuild the tail from here.
        for (let j = i; j < kids.length; j++) kids[j].remove();
        break;
      }
      const ms = mediaSig(m);
      if (li.dataset.media !== ms) {
        const fresh = renderMsg(m, ctx);
        fresh.dataset.id = m.id;
        fresh.dataset.media = ms;
        fresh.dataset.social = socialSig(m, ctx);
        li.replaceWith(fresh);
      } else if (li.dataset.social !== socialSig(m, ctx)) {
        updateSocial(li, m, ctx);
        li.dataset.social = socialSig(m, ctx);
      }
    }
    for (; i < snap.msgs.length; i++) {
      const m = snap.msgs[i];
      const li = renderMsg(m, ctx);
      li.dataset.id = m.id;
      li.dataset.media = mediaSig(m);
      li.dataset.social = socialSig(m, ctx);
      msgsList.append(li);
    }
    if (kids.length > snap.msgs.length) {
      for (let j = snap.msgs.length; j < kids.length; j++) kids[j].remove();
    }
    if (stick) msgsList.scrollTop = msgsList.scrollHeight;
  }

  function renderMsg(m: ChatMessage, ctx: TickCtx): HTMLLIElement {
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

    // File types the browser itself can display get a preview above the card.
  const addPreview = (chip: HTMLElement, url: string, mime: string, name: string, blob: Blob) => {
    if (mime.startsWith('image/')) {
      const img = el('img', 'thumb');
      img.src = url;
      img.alt = name;
      chip.append(img);
    } else if (mime === 'application/pdf') {
      const fr = el('iframe', 'pdfview');
      fr.src = url;
      fr.title = name;
      chip.append(fr);
    } else if (mime.startsWith('video/')) {
      const v = el('video', 'vidview');
      v.src = url;
      v.controls = true;
      // Local blob, so buffering is free; Safari needs both auto preload and
      // a tiny seek before it will paint the first frame.
      v.preload = 'auto';
      // iOS Safari otherwise takes the whole screen when someone taps play.
      v.playsInline = true;
      v.addEventListener(
        'loadedmetadata',
        () => {
          v.currentTime = 0.01;
        },
        {once: true},
      );
      chip.append(v);
    } else if (mime.startsWith('audio/')) {
      const a = el('audio');
      a.src = url;
      a.controls = true;
      chip.append(a);
    } else if (mime.startsWith('text/')) {
      const pre = el('pre', 'txtprev');
      pre.textContent = 'Preview loading...';
      blob.text().then(
        (t) => {
          pre.textContent = t.slice(0, 400);
        },
        () => {
          pre.remove();
        },
      );
      chip.append(pre);
    }
  };

  // Icon, name and size, then Download and, when the browser can show the
  // type, Open in a new tab.
  const fileCard = (url: string, name: string, size: number, mime: string) => {
    const card = el('div', 'filecard');
    const icon = el('span', 'ficon');
    icon.textContent = extOf(name);
    const meta = el('div', 'fmeta');
    const nm = el('div', 'fnm');
    nm.textContent = name;
    nm.title = name;
    const sz = el('div', 'fsz');
    sz.textContent = fmtSize(size);
    meta.append(nm, sz);
    const btns = el('div', 'fbtns');
    const dl = el('a', 'fbtn');
    dl.href = url;
    dl.download = name;
    dl.textContent = 'Download';
    btns.append(dl);
    if (openable(mime)) {
      const op = el('a', 'fbtn');
      op.href = url;
      op.target = '_blank';
      op.rel = 'noopener noreferrer';
      op.textContent = 'Open';
      btns.prepend(op);
    }
    card.append(icon, meta, btns);
    return card;
  };

  if (m.file) {
      const chip = el('div', 'filechip');
      if (m.file.blob) {
        let url = fileUrls.get(m.id);
        if (!url) {
          url = URL.createObjectURL(m.file.blob);
          fileUrls.set(m.id, url);
        }
        addPreview(chip, url, m.file.mime, m.file.name, m.file.blob);
        chip.append(fileCard(url, m.file.name, m.file.size, m.file.mime));
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

    const state = tickState(m, ctx);
    if (state) {
      const ticks = el('span', 'ticks' + (state === 'read' ? ' read' : ''));
      ticks.innerHTML = tickSvg(state);
      li.append(ticks);
    }

    return li;
  }

  showLanding();
}
