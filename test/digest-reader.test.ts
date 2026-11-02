import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const night = '2026-10-28';
const event = { at: '2026-10-29T01:00:00+01:00', job: 'job', status: 'ok', owner: null };
let runsDir: string;

beforeEach(() => { runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-reader-')); });
afterEach(() => { rmSync(runsDir, { recursive: true, force: true }); });

function writeLines(lines: string[]): void {
  writeFileSync(join(runsDir, `${night}.jsonl`), lines.join('\r\n'));
}

describe('readNight', () => {
  it('summarizes the read-only fixture into five sorted jobs and one bad line', () => {
    expect(readNight('runs', night)).toEqual({
      night,
      badLines: 1,
      counts: { ok: 10, retry: 4, fail: 1 },
      rows: [
        { job: 'digest/render', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-29T05:41:09+01:00', lastAt: '2026-10-29T05:41:09+01:00' },
        { job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503',
          firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00' },
        { job: 'lane/sync', owner: 'rook', runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held',
          firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00' },
        { job: 'notes/backup', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded',
          firstAt: '2026-10-29T04:00:01+01:00', lastAt: '2026-10-29T04:00:01+01:00' },
        { job: 'rig/rotate-logs', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-28T23:00:02+01:00', lastAt: '2026-10-28T23:00:02+01:00' },
      ],
    });
  });

  it('returns null for a missing file and a zero summary for an empty file', () => {
    expect(readNight(runsDir, night)).toBeNull();
    writeLines([]);
    expect(readNight(runsDir, night)).toEqual({
      night, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it.each(['../2026-10-28', '..\\2026-10-28', '2026-10-28.jsonl', '2026-1-01',
    '2026-02-29', '2026-13-01', '2026-04-31', '2026-10-28\n', ''])('rejects invalid night %j', (invalid) => {
    expect(readNight(runsDir, invalid)).toBeNull();
  });

  it('accepts a leap-day night', () => {
    writeFileSync(join(runsDir, '2024-02-29.jsonl'), '');
    expect(readNight(runsDir, '2024-02-29')?.night).toBe('2024-02-29');
  });

  it('counts malformed and nonconforming records while retaining valid events', () => {
    const invalid: unknown[] = [null, [], 7, {}, { ...event, job: 1 }, { ...event, job: ' ' },
      { ...event, status: 'running' }, { ...event, status: ['ok'] },
      { ...event, owner: 42 }, { at: event.at, job: 'job', status: 'ok' },
      { ...event, error: null }, { ...event, error: 7 }, { ...event, at: 'not a date' },
      { ...event, at: '2026-02-30T01:00:00Z' }, { ...event, at: '2026-10-29T01:00:00' }];
    writeLines([JSON.stringify(event), '{broken', ...invalid.map((value) => JSON.stringify(value)),
      '', JSON.stringify({ ...event, job: 'another' }), '']);
    const digest = readNight(runsDir, night);
    expect(digest?.badLines).toBe(invalid.length + 2);
    expect(digest?.counts).toEqual({ ok: 2, retry: 0, fail: 0 });
    expect(digest?.rows.map((row) => row.job)).toEqual(['another', 'job']);
  });

  it('uses event instants and stable ties, preserving offsets and the latest reported error', () => {
    const events = [
      { ...event, at: '2026-10-29T03:00:00+01:00', owner: 'latest' },
      { ...event, at: '2026-10-29T03:00:00+02:00', status: 'fail', error: 'latest error' },
      { ...event, at: '2026-10-29T00:00:00Z', status: 'retry', error: 'older error' },
      { ...event, at: '2026-10-29T02:00:00Z', status: 'retry' },
      { ...event, at: '2026-10-28T23:00:00-01:00', status: 'fail', error: 'same instant, later line' },
    ];
    writeLines(events.map((value) => JSON.stringify(value)));
    expect(readNight(runsDir, night)).toEqual({
      night, badLines: 0, counts: { ok: 1, retry: 2, fail: 2 },
      rows: [{ job: 'job', owner: null, runs: 5, retries: 2, lastStatus: 'retry',
        lastError: 'latest error', firstAt: '2026-10-29T00:00:00Z', lastAt: '2026-10-29T02:00:00Z' }],
    });
  });

  it('lets a later input record win when errors share an instant', () => {
    writeLines([
      JSON.stringify({ ...event, status: 'fail', error: 'first' }),
      JSON.stringify({ ...event, status: 'retry', error: 'second' }),
      JSON.stringify(event),
    ]);
    expect(readNight(runsDir, night)?.rows[0]).toMatchObject({ lastStatus: 'ok', lastError: 'second' });
  });

  it('does not hide filesystem errors other than a missing file', () => {
    mkdirSync(join(runsDir, `${night}.jsonl`));
    expect(() => readNight(runsDir, night)).toThrow();
  });
});
