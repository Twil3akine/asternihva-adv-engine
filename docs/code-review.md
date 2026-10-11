# Existing implementation review

Reviewed the ten preceding stacked changes against the initial master, including
runtime/save schema, restoration, cancellation, stage/UI/audio disposal, router,
catalog, exports, package smoke and browser shell. Findings are about behavior,
not presentation preferences.

| Severity | Finding | Resolution |
| --- | --- | --- |
| blocker | The old example and related tests/import helpers carried game-specific character/asset/configuration details despite a clean npm allowlist. | Remove the old example and scripts, rebuild an independent generic sample and add tracked-tree/packed-file checks in this change. |
| important | Implicit scene exhaustion finished without resetting the safe checkpoint flag, so a completed valid scenario could reject Save. | Reset safety after terminal presentation settles; regression test covers round trip. |
| important | A renderer that threw during stage construction left earlier instances attached. Missing renderer registration could also fail after partial construction. | Preflight registrations; dispose previously created instances on construction failure. Regression test verifies destruction. |
| important | The example's pagehide handler disposed the panel/keyboard but relied on ordering of another handler for playback cleanup. | Explicitly release playback in the generic host's pagehide handler; release is idempotent. |
| minor | Cancelled restoration waits for an injected adapter's pending promise to settle. There is no transactional presentation rollback. | Preserve the documented contract and epoch checks; applications must dispose adapters and prevent their late work. No breaking cancellation API introduced. |
| minor | Save schema lacks a scenario-content revision or host migration hook. ID/node reordering can make a structurally valid old save point elsewhere. | Document stable IDs and host migration policy; defer schema changes until compatibility policy is agreed. |
| minor | Non-looping BGM logical state can outlive actual playback; resume restarts that track. | Current save contract stores requested logical BGM, not playback position/completion. Keep behavior documented; adapter completion events remain future work. |
| minor | Sample settings/controls assume one page lifetime. They are not reusable SPA components. | Keep those helpers in the example, outside package exports. The external consumer verifies the public API without importing them. |

The existing core boundary remains DOM-free. Input handlers are snapshot-dispatched
by priority and own unsubscribe functions. Pending UI listeners, image leases,
audio generations and contexts have explicit cleanup. Save schema v1 remains
additive-compatible; no format/package/API rename is proposed.

The new tree boundary does not erase historical Git objects or change the default
branch while the PR stack is unmerged. History removal would require a separate,
explicitly authorized repository operation.
