# Consumer architecture and deployment preparation

The engine owns runtime, adapters, formats and generic tooling. A separate game
consumer owns scenario sources, character definitions, asset originals/manifests,
backgrounds, audio, theme, host UI and deployment settings. Use only documented
package exports; the independent installed-package fixture demonstrates this.

Keep a game's source repository private when desired. Its built HTML, JS, CSS,
runtime scenario data, optimized images and audio are intentionally public after
deployment. Source privacy does not prevent players downloading delivered data.
Do not rely on obfuscation to protect browser assets.

## Repository options

| Option | Benefit | Tradeoff |
| --- | --- | --- |
| App inside a scenario repository | One checkout and atomic story/app updates | Mixes writing, binary originals, dependencies and deployment responsibilities |
| Separate private game repository (recommended) | Clear ownership, independent CI and asset/deployment lifecycle | Must pin and synchronize the scenario source revision |

Keep the current scenario repository canonical initially. A consumer build can
read a separately checked-out, pinned revision and copy only selected runtime
exports into its bundle. Do not edit sources during import. Any later canonical
source move needs an explicit migration decision, not an engine update.
Pin a reviewed engine version/tarball and commit the lockfile. A version in this
repository does not imply that an npm release has been published.

## Hosting comparison

| Target | Static game | Preview/workflow | Rollback | Assessment |
| --- | --- | --- | --- | --- |
| Workers Static Assets + locked Wrangler | Asset-only configuration, no Worker entry required | Explicit CI/manual control, separately configured preview target | Worker version rollback | Recommended for a new static consumer |
| Cloudflare Pages | Supported static output | Private/public Git integration; production branch and other-branch previews | Prior successful production deployment | Good when Git-integrated previews are the main priority |
| Separate object storage/CDN | Useful for oversized media | Additional upload/cache lifecycle | Requires coordinated content versions | Add only if actual asset inventory requires it |

Both static hosting options serve ordinary browser files; mobile behavior belongs
to the consumer and engine rather than the hosting choice. Workers automatically
cache static assets. Current individual file limit is 25 MiB; the Free plan allows
20,000 files per version (Paid 100,000). Inspect real audio/image outputs before
choosing a plan or adding an object-storage dependency.

## Inactive templates

Copy `templates/consumer/` into the consumer only after review. The configuration
is an example, not an active deployment. Replace generic name/domain, review the
compatibility date and lock Wrangler. An active Cloudflare zone and hostname
availability are prerequisites for a custom domain; this project does not create
either. No Cloudflare Access is needed for a public game.

`workers_dev` and `preview_urls` are explicitly false in production. If a public
preview is desired, use a separate Worker/config with its own name and no
production route; enabling preview also exposes bundled story/media. Start with
manual workflow dispatch and a protected `production` environment. Keep tokens
in consumer secrets, restricted to the necessary account/Worker scope. The
`.yml.example` file is inactive and must not be placed in this engine's workflows.

The workflow assumes the consumer defines typecheck/test/build/browser scripts,
has a committed lockfile, and contains its own installed, locked Wrangler. For a
separate private story checkout, add read-only authentication and pin its commit
before build. Never reuse engine CI permissions for private-story access.

## Production output

Build source maps disabled (`sourcemap: false` with esbuild). Keep any diagnostic
maps as restricted internal artifacts, never in the deployed directory. The
local-only `release-check.mjs` rejects map files/references, hidden source files,
symlinks, unexpected extensions, oversized files and a missing index. It is an
output hygiene check, not a general secret scanner. It never deletes or deploys.

Copy `_headers` into output. Only place content-hashed immutable files under
`/static/`; mutable HTML/manifests and non-hashed files must revalidate. Cache
policy is part of release correctness: test new releases with existing saves,
old tabs and changed assets. Keep scenario IDs/node order stable or make a host
save-migration decision. Rollback may not restore browser localStorage.

## Review checklist before a future deployment

1. Review/merge engine changes and choose a pinned consumer dependency.
2. Supply actual licensed assets and consumer registries; validate all chapters.
3. Build from pinned scenario sources; run installed-package and browser checks.
4. Check production output, source maps, file sizes and hashed-cache rules.
5. Test real landscape iPhone/Safari and Android, including audio user gesture.
6. Review custom domain availability, production protection and scoped secrets.
7. Make an explicit deployment decision; record the previous deployment/version.

## Primary sources (checked 2026-10-11)

- [Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Platform limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- [Custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Workers rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
- [Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Pages rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/)
- [GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
