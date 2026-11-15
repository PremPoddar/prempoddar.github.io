// Receipts and reactions, as pure merges over the message ids.

export type Social = {
  seen: Record<string, string[]>;
  reactions: Record<string, Record<string, string[]>>;
};

export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'] as const;

export function emptySocial(): Social {
  return {seen: {}, reactions: {}};
}

export function applyRead(s: Social, byName: string, ids: string[]): Social {
  const seen = {...s.seen};
  for (const id of ids) {
    const names = seen[id] ?? [];
    if (!names.includes(byName)) seen[id] = [...names, byName];
  }
  return {...s, seen};
}

export function applyReact(s: Social, byName: string, id: string, emoji: string): Social {
  const forId = s.reactions[id] ?? {};
  const names = forId[emoji] ?? [];
  const next = names.includes(byName) ? names.filter((n) => n !== byName) : [...names, byName];
  return {...s, reactions: {...s.reactions, [id]: {...forId, [emoji]: next}}};
}
