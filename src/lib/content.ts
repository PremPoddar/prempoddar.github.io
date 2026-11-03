type Dated = { data: { date: Date; draft: boolean } };

export function publishedPosts<T extends Dated>(posts: T[], isProd: boolean): T[] {
  return posts
    .filter((p) => !(isProd && p.data.draft))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function byOrder<T extends { data: { order: number } }>(xs: T[]): T[] {
  return [...xs].sort((a, b) => a.data.order - b.data.order);
}
