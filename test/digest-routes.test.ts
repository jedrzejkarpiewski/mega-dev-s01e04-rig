import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = {
  adapter: 'test-adapter',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: '',
};
const night = '2026-10-28';
const savedLaneId = process.env.LANE_ID;
const savedLaneMarker = process.env.LANE_MARKER;
let runsDir: string;

beforeEach(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  config.runsDir = runsDir;
  process.env.LANE_ID = 'test-lane';
  process.env.LANE_MARKER = 'ROUTE-TEST-MARKER';
});

afterEach(() => {
  rmSync(runsDir, { recursive: true, force: true });
  if (savedLaneId === undefined) delete process.env.LANE_ID;
  else process.env.LANE_ID = savedLaneId;
  if (savedLaneMarker === undefined) delete process.env.LANE_MARKER;
  else process.env.LANE_MARKER = savedLaneMarker;
});

function writeNight(date: string, lines: string[]): void {
  writeFileSync(join(runsDir, `${date}.jsonl`), lines.length === 0 ? '' : `${lines.join('\n')}\n`);
}

describe('digest routes', () => {
  it('returns matching HTML and JSON for a populated night, retaining warnings and the lane banner', async () => {
    writeNight(night, [
      JSON.stringify({ at: '2026-10-28T23:00:00+01:00', job: 'alpha', status: 'retry', owner: null, error: 'first retry' }),
      '{malformed record',
      JSON.stringify({ at: '2026-10-29T00:00:00+02:00', job: 'alpha', status: 'retry', owner: null }),
      JSON.stringify({ at: '2026-10-29T01:00:00Z', job: 'alpha', status: 'retry', owner: null }),
      JSON.stringify({ at: '2026-10-29T02:00:00-05:00', job: 'alpha', status: 'fail', owner: null, error: 'final failure' }),
      JSON.stringify({ at: '2026-10-29T03:00:00+01:00', job: 'beta', status: 'ok', owner: 'bea' }),
    ]);

    const app = createApp(config);
    const [htmlResponse, jsonResponse] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);
    const html = await htmlResponse.text();
    const digest = await jsonResponse.json();

    expect(htmlResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(digest).toMatchObject({
      night,
      badLines: 1,
      rows: [
        {
          job: 'alpha', owner: null, runs: 4, retries: 3, lastStatus: 'fail',
          lastError: 'final failure', firstAt: '2026-10-28T23:00:00+01:00',
          lastAt: '2026-10-29T02:00:00-05:00',
        },
        { job: 'beta', owner: 'bea', runs: 1, retries: 0, lastStatus: 'ok' },
      ],
    });
    expect(html.indexOf('<td>alpha</td>')).toBeLessThan(html.indexOf('<td>beta</td>'));
    expect(html).toContain('1 malformed line counted.');
    expect(html).toContain('ROUTE-TEST-MARKER');
    expect(html).toContain('—');
    expect(html).toContain('2026-10-28T23:00:00+01:00');
    expect(html).toContain('2026-10-29T02:00:00-05:00');
    expect(html).toContain('<td class="warn">3</td>');
    expect(html).toContain('<td class="warn">fail</td>');
    expect(html).toContain('final failure');
  });

  it('returns 404 from both endpoints for missing and invalid nights', async () => {
    const app = createApp(config);
    for (const date of [night, '2026-02-30']) {
      const [htmlResponse, jsonResponse] = await Promise.all([
        app.request(`/digest/${date}`),
        app.request(`/api/digest/${date}`),
      ]);
      expect(htmlResponse.status).toBe(404);
      expect(jsonResponse.status).toBe(404);
    }
  });

  it('renders an empty night in both representations', async () => {
    writeNight(night, []);
    const app = createApp(config);
    const [htmlResponse, jsonResponse] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);

    expect(htmlResponse.status).toBe(200);
    expect(await htmlResponse.text()).toContain('nothing ran');
    expect(jsonResponse.status).toBe(200);
    expect(await jsonResponse.json()).toMatchObject({ night, rows: [], badLines: 0 });
  });

  it('links each night on the board and shows its event counts', async () => {
    writeNight('2026-10-27', [
      JSON.stringify({ at: '2026-10-27T01:00:00Z', job: 'backup', status: 'ok', owner: null }),
      JSON.stringify({ at: '2026-10-27T02:00:00Z', job: 'backup', status: 'fail', owner: null }),
    ]);
    writeNight('2026-10-28', [
      JSON.stringify({ at: '2026-10-28T01:00:00Z', job: 'sync', status: 'retry', owner: 'rook' }),
    ]);
    const response = await createApp(config).request('/');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a>');
    expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a>');
    expect(html).toMatch(/2026-10-28<\/a><\/td>\s*<td>0<\/td>\s*<td>1<\/td>\s*<td>0<\/td>/);
    expect(html).toMatch(/2026-10-27<\/a><\/td>\s*<td>1<\/td>\s*<td>0<\/td>\s*<td>1<\/td>/);
  });
});
