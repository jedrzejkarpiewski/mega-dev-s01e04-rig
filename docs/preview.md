# Digest preview on Mikrus

Publish one static HTML copy of `GET /digest/2026-10-28` on the user's Mikrus VPS.
The source service and JSON endpoint remain on localhost. The VPS only needs a
static web server; Node.js is needed locally to export the HTML.

The marked preview is live at https://dawid220-8084.mikrus.cloud/ . Nginx serves
only the exported HTML from `/srv/s01e04-preview` on `[::]:8084`; Mikrus provides
the public HTTPS proxy and certificate. The service starts automatically with
the VPS. GitHub Pages is retired as a deployment target; there is no publication
workflow in this checkout.

The current public source repository is
https://github.com/jedrzejkarpiewski/mega-dev-s01e04-rig . Its history preserves the
completed implementation and the new template repository's initial commit.
The original repository and its submission records are retained separately.

## Export the marked page

Use the existing locked dependencies. Pass the issued `LANE_MARKER` privately in
the export process environment, then run from the checkout:

```sh
node scripts/export-preview.mjs --mode marked --out .preview/digest
```

The exporter starts the real service on an ephemeral loopback port without loading
`.env`, fetches the exact HTML response, checks its banner and self-contained
structure, and saves only `index.html`. It never prints the HTML or marker.
Output inside the checkout must stay under ignored `.preview/` or `_site/`.
Never commit or attach the generated file, `.env`, or an SSH private key.

## Upload and verify

The shared local SSH alias is `mikrus`. Its identity and host keys live in the
user's SSH directory outside this repository. Use `ssh -o BatchMode=yes mikrus`
for noninteractive operations; normal execution/network approvals still apply.

The web root is `/srv/s01e04-preview`. The active configuration is
`/etc/nginx/conf.d/s01e04-preview.conf`, versioned here as `deploy/nginx.conf`.
Only `/` and `/index.html` serve the exported page; other paths return 404.
Responses use `Cache-Control: no-store` so a later marker replacement is visible.
Mikrus's managed HTTPS subdomains require the HTTP listener to be reachable over
IPv6; see its [subdomain documentation](https://wiki.mikr.us/darmowa_subdomena_dla_vps/).

Upload a prepared copy and replace the file atomically:

```sh
scp -o BatchMode=yes .preview/digest/index.html mikrus:/srv/s01e04-preview/index.html.next
ssh -o BatchMode=yes mikrus 'chmod 644 /srv/s01e04-preview/index.html.next && mv /srv/s01e04-preview/index.html.next /srv/s01e04-preview/index.html'
```

Fetch the actual public HTTPS URL before reporting a deployment. Privately verify
HTTP 200, the issued marker, five sample jobs, one malformed line, and no external
assets or client scripts. Record the verified URL and content hash outside Git.

The previous course claim used a different host and an inaccessible repository.
The human approved trying this replacement host and the public personal-account
repository. Preserve every previous answer, receipt and raw response as private
history. Keep cleanup issue #8 open until actual review and replacement approval.

## Replace after review

After actual review and the separately required approval for marker removal,
export a clean copy:

```sh
node scripts/export-preview.mjs --mode clean --out .preview/digest
```

Clean mode unsets `LANE_MARKER` and does not load `.env`. Upload this copy over the
same Mikrus URL and verify `no marker set` is present and the issued marker is
absent. Only then archive `plan.md` with its issue list and close issue #8.

## Previous deployment

Deleting the local Pages workflow does not withdraw an existing remote Pages
site. The historical deployment and saved verification evidence remain in the
parent challenge records. Retiring the old remote site still needs to be handled
when the original GitHub account access is restored; no remote withdrawal has
been performed as part of this migration.
