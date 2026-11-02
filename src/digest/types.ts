export type DigestStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  /** All valid events for this job, including retries and failures. */
  runs: number;
  /** Events whose status is retry. */
  retries: number;
  lastStatus: DigestStatus;
  /** Most recent reported error, retained after recovery; null if none. */
  lastError: string | null;
  /** Original log timestamps, preserving their offsets. */
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  /** One row per job, sorted by job. */
  rows: DigestRow[];
  /** Malformed JSON and lines that do not conform to the log schema. */
  badLines: number;
  /** Valid log events by status, rather than final job statuses. */
  counts: {
    ok: number;
    retry: number;
    fail: number;
  };
};

/**
 * Read runs/<night>.jsonl. A missing file or invalid night returns null.
 * An empty file returns an empty rows array, zero bad lines, and zero counts.
 */
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
