import { Hono } from 'hono';
import type { ReadNight } from './types.js';

export function registerDigestJson(
  app: Hono,
  runsDir: string,
  readNight: ReadNight,
): void {
  app.get('/api/digest/:night', (c) => {
    const digest = readNight(runsDir, c.req.param('night'));

    if (digest === null) {
      return c.json({ error: 'Night not found' }, 404);
    }

    return c.json(digest);
  });
}
