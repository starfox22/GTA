# Browser preview of the Codex branch

**Play: https://starfox22.github.io/GTA/**. The owner enabled the required setting
on October 15. [The first successful deployment](https://github.com/starfox22/GTA/actions/runs/38793337239)
published `bd4ec11` and passed exact full-file verification of all 18 public files.
[Evidence](audit/browser-preview-2026-10-15/successful-deployment.json).

The owner requested one browser link instead of downloading each review ZIP.
`.github/workflows/codex-review-pages.yml` builds and deploys **`codex-reviews`**
with GitHub Pages whenever that branch changes. It does not push to `main`,
create a separate development branch, commit generated media, or update the
existing claude.ai/chatgpt.site publication. ZIP releases remain available.

## One-time repository setup

An administrator opens [Settings → Pages](https://github.com/starfox22/GTA/settings/pages)
and selects **GitHub Actions** under **Build and deployment → Source**.
If this has not been done, the workflow stops at “Check Pages configuration”.
The ordinary workflow token can deploy but cannot enable Pages; upstream
[`configure-pages`](https://github.com/actions/configure-pages/blob/v5/action.yml)
requires a separate administrator token for initial enablement. Do not add or
request a personal token just for this: the repository setting is sufficient.

After enabling it, open the most recent **Play Codex review** run under
[Actions](https://github.com/starfox22/GTA/actions) and choose **Re-run all jobs**.
Rerunning its push-triggered execution works even while the new workflow exists
only on the review branch; the manual Run workflow button may require its file
to exist on the default branch. Future pushes deploy automatically.

The deployment uses a dedicated **`codex-review-pages`** environment. If repository
policy requires approval or restricts that environment's branches, allow
`codex-reviews` in that environment. No production environment's rules are changed
by this workflow. GitHub provides one Pages site per repository: if it is already
used for another publication, keep that in mind before changing its source.

## Build, verification and link

The workflow runs `python3 tools/build.py --split-media dist/pages`. The result is
the same game HTML and relative media used in the tested ZIP, served over HTTPS.
Classic media script tags and relative radio URLs work under a project subpath;
there is no build output in Git and no extra runtime service.

`actions/deploy-pages` supplies the actual `page_url`; the environment deployment
link is the browser link to bookmark. Do not advertise a guessed URL as a working
site before deployment succeeds. `tools/verify-pages.py` then downloads **every**
public artifact file and checks its full SHA-256 against the local build. It
retries CDN propagation briefly and makes no claims about browser GPU performance.

After the workflow finishes, reload the bookmark to play the latest review.
GitHub's CDN and the browser can retain an older response briefly; a hard refresh
can help. Browser saves belong to the site's origin and do not automatically move
from a downloaded file or a different hosted domain.

Local verification, using the environment's configured browser adapter:

```sh
python3 tools/build.py --split-media dist/pages
python3 tools/verify-pages.py dist/pages http://127.0.0.1:8765/dist/pages/
node tools/media-check.mjs dist/pages/index.html
```

The loopback check verifies the packaging/relative paths, not a public deployment.
Record actual workflow status and any settings blocker before handing off to the
owner or Claude. If direct access to `*.github.io` is blocked in an execution
environment, distinguish that network limitation from the site's deployment state.

The [initial run](https://github.com/starfox22/GTA/actions/runs/38792992642) stopped
with Pages configuration `Not Found`; it did not publish a site. Local packaging,
full-file HTTP comparison and all nine streamed tracks passed. The owner then
enabled GitHub Actions as the Pages source and the next deployment succeeded,
as linked above. The execution environment blocks direct `github.io` requests,
so public byte verification ran on GitHub's runner. Its success is distinct
from the earlier local browser/packaging checks.

## Screenshot and sound review

The October 15 police/aviation review adds **https://starfox22.github.io/GTA/review/**.
`tools/build-review-gallery.py dist/pages` copies the checked-in native comparison
images and production-graph MP3 samples selected by
`docs/audit/police-aviation-review-2026-10-15/gallery.json`, then writes a static
mobile-friendly page. The Pages workflow runs this after the split game build.
`verify-pages.py` verifies the gallery and every image/audio file as well as the
game. Missing evidence stops the gallery build; it never creates placeholder or
synthetic screenshots. The game remains at the root URL.

Split builds add full SHA-256 queries to media-pack and streamed-track URLs.
Gallery image/audio URLs use the same content identity rule. Unchanged files
keep their URL across deployments; changed files invalidate browser caches.
`python3 tools/build-media-cache-check.py` checks both behaviours with isolated
changed and unchanged assets. The classic script tags remain compatible with
relative local-file loading.
