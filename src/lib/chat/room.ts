// Adapter between the pure chat model and Trystero (BitTorrent introductions).
// Holds the live message list; all membership truth flows through reduceRoom.

import {joinRoom} from '@trystero-p2p/torrent';
import {MAX_FILE_BYTES, fileTooBig, parseSegments, type Segment} from './message';
import {type Role, type RoomState, type Roster, reduceRoom, roleOf} from './room-model';
import {applyRead, emptySocial} from './social';

export type ChatMessage = {
  id: string;
  from: string;
  fromName: string;
  ts: number;
  mine: boolean;
  parts?: Segment[];
  file?: {name: string; mime: string; size: number; blob?: Blob; pct?: number};
  seenBy: string[];
};

export type Snapshot = {room: RoomState; role: Role; msgs: ChatMessage[]; error?: string};

export type ChatHandle = {
  subscribe: (fn: (s: Snapshot) => void) => () => void;
  accept: (userId: string) => void;
  decline: (userId: string) => void;
  sendText: (raw: string) => void;
  sendFile: (f: File, onPct: (p: number) => void) => void;
  setName: (name: string) => void;
  leave: () => Promise<void>;
};

const APP_ID = 'prempoddar.is-a.dev/chat';
const MAX_USERS = 8;
const norm = (pct: number) => (pct > 1 ? pct / 100 : pct);

type CtlWire = {kind: 'roster'; roster: Roster} | {kind: 'decline'};
type ChatWire = {id: string; ts: number; parts: Segment[]};
type FileMeta = {msgId: string; name: string; mime: string; size: number};
type SocialWire = {kind: 'read'; ids: string[]};

export function startRoom(opts: {code: string; name: string; create: boolean}): ChatHandle {
  const room = joinRoom({appId: APP_ID, password: opts.code, maxUsers: MAX_USERS}, opts.code);
  const profile = room.makeUserState('profile', {name: opts.name});
  // The initial value is only a fallback; it must be published to reach peers.
  void profile.set({name: opts.name});
  const ctl = room.makeAction<CtlWire>('ctl');
  const chat = room.makeAction<ChatWire>('chat');
  const fileAct = room.makeAction('file');
  const socialAct = room.makeAction<SocialWire>('social');

  let selfId = '';
  let myName = opts.name;
  let roomState: RoomState = {roster: null, pending: [], connected: [], declined: false};
  let msgs: ChatMessage[] = [];
  let social = emptySocial();
  let error: string | undefined;
  const acked = new Set<string>();
  const subs = new Set<(s: Snapshot) => void>();
  let readTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (!selfId) return;
    const snap: Snapshot = {
      room: roomState,
      role: roleOf(roomState, selfId),
      error,
      msgs: msgs.map((m) => ({
        ...m,
        seenBy: social.seen[m.id] ?? [],
      })),
    };
    for (const fn of subs) fn(snap);
    scheduleReads();
  };

  // Events queue until getSelf() gives us our own userId.
  const queue: Parameters<typeof reduceRoom>[1][] = [];
  let ready = false;
  const dispatch = (e: Parameters<typeof reduceRoom>[1]) => {
    if (!ready) {
      queue.push(e);
      return;
    }
    roomState = reduceRoom(roomState, e);
    flush();
  };

  const memberIds = () => new Set(roomState.roster?.members.map((m) => m.userId) ?? []);
  const peerIdsOf = (userIds: Set<string>) =>
    Object.entries(room.getPeers())
      .filter(([, p]) => userIds.has(p.userId))
      .map(([peerId]) => peerId);
  const memberTargets = () => peerIdsOf(memberIds());
  const targetsOf = (userId: string) => peerIdsOf(new Set([userId]));
  const nameOf = (userId: string) =>
    (profile.getAll()[userId] as {name?: string} | undefined)?.name ?? 'Member';

  const broadcastRoster = () => {
    if (!roomState.roster) return;
    const targets = memberTargets();
    if (targets.length) void ctl.send({kind: 'roster', roster: roomState.roster}, {target: targets});
  };

  const sendSocial = (payload: SocialWire) => {
    const targets = memberTargets();
    if (targets.length) void socialAct.send(payload, {target: targets});
  };

  const scheduleReads = () => {
    if (readTimer || document.visibilityState !== 'visible') return;
    const ids = msgs.filter((m) => !m.mine && !acked.has(m.id)).map((m) => m.id);
    if (!ids.length) return;
    readTimer = setTimeout(() => {
      readTimer = null;
      for (const id of ids) acked.add(id);
      social = applyRead(social, myName, ids);
      sendSocial({kind: 'read', ids});
      flush();
    }, 350);
  };
  const onVis = () => {
    if (document.visibilityState === 'visible') scheduleReads();
  };
  document.addEventListener('visibilitychange', onVis);

  room.onUserJoin(
    ({userId}) => {
      dispatch({type: 'peer-joined', userId, name: nameOf(userId)});
      // A rostered member reconnecting (refresh) gets the roster again at once.
      if (ready && roomState.roster?.members.some((m) => m.userId === userId)) {
        void ctl.send({kind: 'roster', roster: roomState.roster}, {target: targetsOf(userId)});
      }
    },
    {replay: true},
  );
  room.onUserLeave(({userId}) => {
    const prevOwner = roomState.roster?.ownerId;
    dispatch({type: 'peer-left', userId});
    // Succession: if I am now the owner, tell the room.
    if (prevOwner && prevOwner !== selfId && roomState.roster?.ownerId === selfId) broadcastRoster();
  });

  ctl.onMessage((payload, ctx) => {
    if (payload.kind === 'roster') dispatch({type: 'roster', roster: payload.roster, from: ctx.userId});
    // Only the roster's owner may decline; a pre-roster joiner cannot verify,
    // which is the plan's residual exposure.
    if (payload.kind === 'decline' && (!roomState.roster || ctx.userId === roomState.roster.ownerId))
      dispatch({type: 'declined-self'});
  });

  chat.onMessage((payload, ctx) => {
    if (!memberIds().has(ctx.userId)) return;
    msgs = [
      ...msgs,
      {id: payload.id, from: ctx.userId, fromName: nameOf(ctx.userId), ts: payload.ts, mine: ctx.userId === selfId, parts: payload.parts, seenBy: []},
    ];
    flush();
  });

  fileAct.onReceive((ctx) => memberIds().has(ctx.userId) && ctx.byteLength <= MAX_FILE_BYTES);
  fileAct.onReceiveProgress((pct, {userId, metadata}) => {
    const meta = metadata as unknown as FileMeta;
    if (!memberIds().has(userId) || typeof meta.msgId !== 'string') return;
    const m = msgs.find((x) => x.id === meta.msgId);
    if (m?.file) m.file.pct = norm(pct);
    else
      msgs = [
        ...msgs,
        {
          id: meta.msgId,
          from: '',
          fromName: 'Member',
          ts: Date.now(),
          mine: false,
          seenBy: [],
          file: {name: meta.name, mime: meta.mime, size: meta.size, pct: norm(pct)},
        },
      ];
    flush();
  });
  fileAct.onMessage((data, {userId, metadata}) => {
    if (!memberIds().has(userId)) return;
    const bytes = data as Uint8Array;
    const meta = metadata as unknown as FileMeta;
    const blob = new Blob([new Uint8Array(bytes)], {type: meta.mime});
    const m = msgs.find((x) => x.id === meta.msgId);
    const done: ChatMessage = m
      ? {...m, from: userId, fromName: nameOf(userId), mine: userId === selfId, file: {...m.file!, blob, pct: undefined}}
      : {
          id: meta.msgId,
          from: userId,
          fromName: nameOf(userId),
          ts: Date.now(),
          mine: userId === selfId,
          seenBy: [],
          file: {name: meta.name, mime: meta.mime, size: meta.size, blob},
        };
    msgs = m ? msgs.map((x) => (x.id === meta.msgId ? done : x)) : [...msgs, done];
    flush();
  });

  socialAct.onMessage((payload, ctx) => {
    if (!memberIds().has(ctx.userId)) return;
    const by = nameOf(ctx.userId);
    if (payload.kind === 'read') social = applyRead(social, by, payload.ids);
    flush();
  });

  profile.onChange((val, {userId}) => {
    if (val && typeof val === 'object' && 'name' in val) dispatch({type: 'rename', userId, name: (val as {name: string}).name});
  });

  room.onError((err) => {
    if (err.code === 'relay-failed') error = 'Could not reach the introduction network. Check your connection.';
    else if (err.code === 'room-full') error = 'The room is full (8 people max).';
    flush();
  });

  void room.getSelf().then((self) => {
    selfId = self.userId;
    ready = true;
    if (opts.create) {
      dispatch({type: 'roster', roster: {ownerId: selfId, members: [{userId: selfId, name: opts.name, order: 1}]}, from: selfId});
    }
    for (const e of queue.splice(0)) dispatch(e);
    flush();
  });

  return {
    subscribe(fn) {
      subs.add(fn);
      flush();
      return () => subs.delete(fn);
    },
    accept(userId) {
      if (roleOf(roomState, selfId) !== 'owner' || !roomState.roster) return;
      const name = nameOf(userId);
      const roster: Roster = {
        ...roomState.roster,
        members: [...roomState.roster.members, {userId, name, order: roomState.roster.members.length + 1}],
      };
      dispatch({type: 'roster', roster, from: selfId});
      broadcastRoster();
    },
    decline(userId) {
      const targets = targetsOf(userId);
      if (targets.length) void ctl.send({kind: 'decline'}, {target: targets});
      // Drop the request row locally too; the joiner gets the wire's declined state.
      dispatch({type: 'peer-left', userId});
    },
    sendText(raw) {
      const parts = parseSegments(raw);
      if (!parts.length) return;
      const msg: ChatMessage = {id: crypto.randomUUID(), from: selfId, fromName: myName, ts: Date.now(), mine: true, parts, seenBy: []};
      msgs = [...msgs, msg];
      const targets = memberTargets();
      if (targets.length) void chat.send({id: msg.id, ts: msg.ts, parts}, {target: targets});
      flush();
    },
    sendFile(f, onPct) {
      if (fileTooBig(f.size)) {
        error = 'That is over the 25 MB limit.';
        flush();
        return;
      }
      const msgId = crypto.randomUUID();
      const targets = memberTargets();
      // Nobody to send to (room empty): keep the file locally as its own blob.
      const msg: ChatMessage = {
        id: msgId,
        from: selfId,
        fromName: myName,
        ts: Date.now(),
        mine: true,
        file: targets.length ? {name: f.name, mime: f.type, size: f.size, pct: 0} : {name: f.name, mime: f.type, size: f.size, blob: f},
        seenBy: [],
      };
      msgs = [...msgs, msg];
      flush();
      if (targets.length)
        void fileAct
          .send(f, {
            target: targets,
            metadata: {msgId, name: f.name, mime: f.type, size: f.size} satisfies FileMeta,
            onProgress: (pct) => {
              const m = msgs.find((x) => x.id === msgId);
              if (m?.file) m.file.pct = norm(pct);
              onPct(norm(pct));
              flush();
            },
          })
          .then(() => {
            // Sender's own chip becomes a download when the bytes have moved.
            const m = msgs.find((x) => x.id === msgId);
            if (m?.file) {
              m.file.blob = f;
              m.file.pct = undefined;
            }
            flush();
          });
    },
    setName(name) {
      myName = name;
      void profile.set({name});
      dispatch({type: 'rename', userId: selfId, name});
    },
    async leave() {
      if (readTimer) clearTimeout(readTimer);
      document.removeEventListener('visibilitychange', onVis);
      await room.leave();
    },
  };
}
