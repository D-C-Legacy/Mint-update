// Shared env/fixture loading for every scenario script. Run `npx ts-node test/load/seed.ts`
// first (writes `test/load/.output/fixtures.json`) and run k6 from the repo root, e.g.:
//   k6 run -e VUS=50 test/load/scenario-1-viewers-bid-fanout.js
// Base URLs default to this repo's documented dev ports (.env.example) — override with
// `-e API_BASE_URL=... -e REALTIME_WS_URL=...` to point at the remapped local ports this
// project's own verification ritual uses (3900/3901), or at a real staging host.

export const apiBaseUrl = __ENV.API_BASE_URL || 'http://localhost:3000';
export const realtimeWsUrl = __ENV.REALTIME_WS_URL || 'ws://localhost:3001';
// Same process/port as realtimeWsUrl — main.realtime.ts serves /metrics over plain HTTP
// alongside the WS upgrade (P9-03), used by scenario 2 to sample process memory during the run.
export const realtimeHttpUrl = realtimeWsUrl.replace(/^ws/, 'http');

export function loadFixtures() {
  const path = __ENV.FIXTURES_PATH || './test/load/.output/fixtures.json';
  const raw = open(path);
  const data = JSON.parse(raw);
  if (!data.buyers || !data.buyers.length || !data.rooms || !data.rooms.length) {
    throw new Error(`${path} has no buyers/rooms — run \`npx ts-node test/load/seed.ts\` first.`);
  }
  return data;
}
