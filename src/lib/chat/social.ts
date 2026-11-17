// Read receipts, as a pure merge over the message ids.

export type Social = {
  seen: Record<string, string[]>;
};

export function emptySocial(): Social {
  return {seen: {}};
}

export function applyRead(s: Social, byName: string, ids: string[]): Social {
  const seen = {...s.seen};
  for (const id of ids) {
    const names = seen[id] ?? [];
    if (!names.includes(byName)) seen[id] = [...names, byName];
  }
  return {...s, seen};
}
