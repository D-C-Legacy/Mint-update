// A stand-in photo for a product or seller that has no real one uploaded yet (the local dev media
// pipeline — MinIO + the real upload flow — isn't wired up in this environment). Seeded by the
// item's own id, so the same item always gets the same picture and different items look different,
// instead of every empty card showing the exact same placeholder. Picsum Photos serves real stock
// photography, needs no API key, and is fine for this kind of non-production placeholder use.
export function stockImageFor(id: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(id)}/600/600`;
}
