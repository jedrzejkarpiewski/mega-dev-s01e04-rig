# Digest preview on Mikrus

Publish one static HTML copy of `GET /digest/2026-10-28` on the user's Mikrus VPS.
The source service and JSON endpoint remain on localhost. The VPS only needs a
static web server; Node.js is needed locally to export the HTML.

SSH key authentication has been verified. The web server, public HTTPS hostname
and initial upload still need to be configured. GitHub Pages is retired as a
deployment target; there is no publication workflow in this checkout.

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

Configure a static web root, proposed as `/srv/s01e04-preview`, and a public HTTPS
hostname before uploading. Serve only the exported HTML from that directory.
Mikrus's managed HTTPS subdomains require the HTTP listener to be reachable over
IPv6; see its [subdomain documentation](https://wiki.mikr.us/darmowa_subdomena_dla_vps/).

Once that web root and hostname have been confirmed, upload and replace the file:

```sh
scp .preview/digest/index.html mikrus:/srv/s01e04-preview/index.html.next
ssh -o BatchMode=yes mikrus 'chmod 644 /srv/s01e04-preview/index.html.next && mv /srv/s01e04-preview/index.html.next /srv/s01e04-preview/index.html'
```

Fetch the actual public HTTPS URL before reporting a deployment. Privately verify
HTTP 200, the issued marker, five sample jobs, one malformed line, and no external
assets or client scripts. Record the verified URL and content hash outside Git.

The previous course claim used a different host. Preserve its receipts and exact
answer, then check the course's current instructions before submitting a new
preview address. A host change alone is not evidence that the review discrepancy
has been resolved. Keep cleanup issue #8 open until actual review.

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
when GitHub account access is restored; no remote withdrawal has been performed
as part of this local checkpoint.
