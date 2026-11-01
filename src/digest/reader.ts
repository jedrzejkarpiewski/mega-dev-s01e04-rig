import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightDigest, ReadNight } from './types.js';

type RunEvent = {
  at: string;
  time: number;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  if (!('at' in value) || typeof value.at !== 'string'
    || !('job' in value) || typeof value.job !== 'string' || value.job.trim() === ''
    || !('status' in value)
    || !('owner' in value) || (value.owner !== null && typeof value.owner !== 'string')
    || ('error' in value && typeof value.error !== 'string')) return null;

  const status = value.status;
  if (status !== 'ok' && status !== 'retry' && status !== 'fail') return null;
  const timestamp = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
  const time = Date.parse(value.at);
  if (!timestamp.test(value.at) || !isDate(value.at.slice(0, 10)) || !Number.isFinite(time)) return null;

  return {
    at: value.at,
    time,
    job: value.job,
    status,
    owner: value.owner,
    ...('error' in value && typeof value.error === 'string' ? { error: value.error } : {}),
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!isDate(night)) return null;
  let content: string;
  try {
    content = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }

  const digest: NightDigest = {
    night,
    rows: [],
    badLines: 0,
    counts: { ok: 0, retry: 0, fail: 0 },
  };
  if (content === '') return digest;
  const lines = content.split(/\r?\n/);
  // A terminating newline ends the preceding record; it is not another record.
  if (lines.at(-1) === '') lines.pop();
  const events: RunEvent[] = [];
  for (const line of lines) {
    const event = parseEvent(line);
    if (event === null) digest.badLines += 1;
    else events.push(event);
  }

  // Stable sorting preserves input order when two events have the same instant.
  events.sort((a, b) => a.time - b.time);
  const jobs = new Map<string, DigestRow>();
  for (const event of events) {
    digest.counts[event.status] += 1;
    let row = jobs.get(event.job);
    if (!row) {
      row = {
        job: event.job,
        owner: event.owner,
        runs: 0,
        retries: 0,
        lastStatus: event.status,
        lastError: null,
        firstAt: event.at,
        lastAt: event.at,
      };
      jobs.set(event.job, row);
    }
    row.runs += 1;
    if (event.status === 'retry') row.retries += 1;
    row.owner = event.owner;
    row.lastStatus = event.status;
    row.lastAt = event.at;
    if (event.error !== undefined) row.lastError = event.error;
  }
  digest.rows = [...jobs.values()].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0);
  return digest;
};
