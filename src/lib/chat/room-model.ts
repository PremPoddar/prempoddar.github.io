// Room membership: roster, approval, succession. Pure state, no network.

export type Member = {userId: string; name: string; order: number};
export type Roster = {ownerId: string; members: Member[]};
export type Role = 'owner' | 'member' | 'pending' | 'waiting' | 'declined';

export type RoomEvt =
  | {type: 'roster'; roster: Roster; from: string}
  | {type: 'peer-joined'; userId: string; name: string}
  | {type: 'peer-left'; userId: string}
  | {type: 'rename'; userId: string; name: string}
  | {type: 'declined-self'};

export type RoomState = {
  roster: Roster | null;
  pending: {userId: string; name: string}[];
  connected: string[];
  declined: boolean;
};

export function nextOwnerAfterLeave(roster: Roster, leavingId: string): Roster {
  const members = roster.members.filter((m) => m.userId !== leavingId);
  return {ownerId: members[0].userId, members};
}

function validRoster(r: Roster): boolean {
  if (r.members.length < 1 || r.members[0].userId !== r.ownerId) return false;
  let last = -Infinity;
  const ids = new Set<string>();
  for (const m of r.members) {
    if (m.order <= last || ids.has(m.userId)) return false;
    last = m.order;
    ids.add(m.userId);
  }
  return true;
}

export function reduceRoom(s: RoomState, e: RoomEvt): RoomState {
  switch (e.type) {
    case 'roster': {
      const ok = s.roster === null ? validRoster(e.roster) : e.from === s.roster.ownerId && validRoster(e.roster);
      return ok ? {...s, roster: e.roster, pending: s.pending.filter((p) => !e.roster.members.some((m) => m.userId === p.userId))} : s;
    }
    case 'peer-joined': {
      const rostered = s.roster?.members.some((m) => m.userId === e.userId) ?? false;
      const connected = s.connected.includes(e.userId) ? s.connected : [...s.connected, e.userId];
      if (rostered) return {...s, connected};
      return {...s, connected, pending: s.pending.some((p) => p.userId === e.userId) ? s.pending : [...s.pending, {userId: e.userId, name: e.name}]};
    }
    case 'peer-left': {
      const connected = s.connected.filter((id) => id !== e.userId);
      const pending = s.pending.filter((p) => p.userId !== e.userId);
      // Regular members stay rostered so a refresh re-enters without approval.
      // Only the owner's departure promotes the successor.
      const roster = s.roster && e.userId === s.roster.ownerId ? nextOwnerAfterLeave(s.roster, e.userId) : s.roster;
      return {...s, connected, pending, roster};
    }
    case 'rename': {
      return {
        ...s,
        roster: s.roster
          ? {...s.roster, members: s.roster.members.map((m) => (m.userId === e.userId ? {...m, name: e.name} : m))}
          : s.roster,
        pending: s.pending.map((p) => (p.userId === e.userId ? {...p, name: e.name} : p)),
      };
    }
    case 'declined-self':
      return {...s, declined: true};
  }
}

export function roleOf(s: RoomState, selfId: string): Role {
  if (s.declined) return 'declined';
  const self = s.roster?.members.find((m) => m.userId === selfId);
  if (self) return s.roster!.ownerId === selfId ? 'owner' : 'member';
  return s.connected.length > 0 ? 'pending' : 'waiting';
}
