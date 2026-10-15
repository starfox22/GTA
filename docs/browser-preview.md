# Browser preview of the Codex branch

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
