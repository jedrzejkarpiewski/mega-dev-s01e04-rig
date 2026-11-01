import type { Hono } from 'hono';
import { lane } from '../lane.js';
import { Layout } from '../views/layout.js';
import { DigestView } from '../views/digest.js';
import type { ReadNight } from './types.js';

export function registerDigestPage(app: Hono, runsDir: string, readNight: ReadNight): void {
  app.get('/digest/:night', (c) => {
    const digest = readNight(runsDir, c.req.param('night'));
    if (digest === null) return c.notFound();

    return c.html(
      <Layout title={`digest · ${digest.night}`} lane={lane()}>
        <DigestView digest={digest} />
      </Layout>,
    );
  });
}
