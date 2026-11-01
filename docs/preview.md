# Digest preview

The manual `Publish digest preview` workflow publishes one static HTML copy of
`GET /digest/2026-10-28` on this repository's GitHub Pages site. The Node service
and JSON endpoint continue to run only on localhost. No push triggers publication.

## Approval before publication

Before the first dispatch, ask the human to approve this named set of actions:

1. Enable GitHub Pages with GitHub Actions as its source in
   `0x54656f/mega-dev-s01e04-rig`.
2. Store the issued marker as the repository Actions secret `LANE_MARKER` without
   putting its value in arguments, logs, Git history, issues, or attachments.
3. Publish the marked sample digest to the public HTTPS Pages URL and send that URL
   and the plan's issues to the course reviewer.
4. Delete the temporary Pages Actions artifact after deployment. A one-day
   retention is the fallback if cleanup cannot run. Remove the marker secret when
   the preview has been verified and no marked retry is needed.

Anyone can read the published HTML. It contains the template's sample run data,
the sample lane ID, and the course marker. The marker is temporary public review
data, not a credential. The expected project URL is
`https://0x54656f.github.io/mega-dev-s01e04-rig/`; use the actual successful deployment
output and fetch that URL before claiming it is live.

## Deploy and review

Use the workflow on `main` with `mode=marked` and `approval=publish-marked` only
after that approval. The exporter starts the real server on an ephemeral loopback
port, fetches its HTML, checks the banner, and saves only `index.html` under
`runner.temp`. It starts Node without loading `.env`; the marker is passed only to
that export step. Dependencies are installed from the lockfile and the application
tests and typecheck must pass before uploading.

After deployment, fetch the public HTTPS URL and check the sample digest and the
issued banner privately. Confirm the run has no remaining Pages artifact, then
send the reviewer the repository, preview URL, and issue list. Leave cleanup issue
#8 open until the reviewer has actually reviewed the preview.

## Replace after review

After review, obtain a **separate human approval** to replace the marked page.
Dispatch the same workflow on `main` with `mode=clean` and
`approval=replace-after-review`. This mode removes `LANE_MARKER` from the service's
environment and never loads `.env`, even if a local file or repository secret
still exists. It exports the same page with `no marker set` and deploys over the
same URL. Fetch that URL again, confirm the old marker is absent and `no marker
set` is present, and remove any remaining marked artifact or marker secret.

Only then archive `plan.md` with the real issue list and close issue #8 with its
worker and commit metadata. Submitting a URL alone is not the review trigger.

## Local export

Install dependencies, set `LANE_MARKER` privately in the environment for a marked
export, then run:

```sh
node scripts/export-preview.mjs --mode marked --out .preview/digest
node scripts/export-preview.mjs --mode clean --out .preview/digest
```

Output inside the checkout is restricted to ignored `.preview/` or `_site/`
directories. The output directory may contain only `index.html`. Exports never
print their HTML or marker. Do not commit or attach the generated file.

To withdraw the whole preview, disable Pages in repository settings. To remove
only the marker, replace the same URL using the approved clean dispatch. Public
readers may already have saved a copy, so replacement cannot recall their copies.

The workflow follows GitHub's [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
and [Pages artifact action](https://github.com/actions/upload-pages-artifact).
