# Next Development Tasks

This task list is derived from `docs/DOCUMENTATION_REVIEW.md`, the current
`0.1.0-alpha.1` stage assessment, and the latest architecture review. It is
intentionally biased toward the next execution window rather than the full
long-term roadmap.

## Guiding Principle

The next wave should be boundary-first:

1. freeze the contract
2. freeze the internal seams
3. decouple runtime ownership
4. close release gates
5. then expand capability

## Runtime Refactor Closure Snapshot (2026-04-23)

The internal runtime seam floor is now real in code.

What already exists:

- `src/runtime/render-session.js`
- `src/runtime/work-scheduler.js`
- `src/runtime/worker-message-router.js`
- `src/runtime/runtime-reaction-plan.js`
- `src/runtime/runtime-work-executor.js`
- `src/runtime/runtime-lifecycle-controller.js`
- `src/runtime/runtime-transition-controller.js`
- `src/runtime/runtime-view-controller.js`
- `src/runtime/worker-dispatch-policy.js`
- `src/runtime/worker-pool.js`
- `src/runtime/runtime-policy.js`

What still intentionally remains in `src/runtime/viewer-runtime.js`:

- public API glue and event emission
- worker bootstrap and tracked request registration
- spectrum request dispatch and pending-spectrum resolution
- source invalidation glue and cancel broadcasting
- DOM interaction wiring
- top-level orchestration across the extracted runtime helpers

Implication:

- do not keep splitting the runtime into smaller controllers by default
- prefer release-facing alpha gates and user-visible capability work unless one
  of the remaining inline responsibilities becomes a real blocker

Release-gate status after the `2026-04-23` local verification pass:

- `npm run verify:alpha` now completes successfully on the current private
  workstation runtime
- local browser-matrix validation now passes for both forced `webgl` and
  `auto` renderer preferences
- a shipped public remote sample now exists and passes the public-tier browser
  validation path
- `npm run verify:node22-local` now passes on a real local Node 22 runtime
- the remaining deferred external gate is GitHub Actions confirmation once the
  repository is ready for that public-facing step

## Global Definition Of Done

Architecture-shaping tasks are only complete when all three checks pass:

1. code: the boundary exists in code, not only in prose
2. tests: contract or smoke coverage protects the change
3. docs: API, architecture, roadmap, and release docs reflect the new truth

Each task below names an owner surface. That owner is the primary boundary that
must absorb the change without leaking it elsewhere.

## P0: Contract Freeze

These tasks close the public-contract holes before more functionality is added.

### P0.1 Freeze `CubeHeader`

Owner: public API and metadata boundary

Status note:

- `docs/API.md` now defines a stable `CubeHeader` with canonical `dataType` and
  `byteOrder` tags
- `src/formats/cube-header.js` now normalizes metadata in code before it crosses
  the adapter/runtime boundary
- boundary tests now assert the concrete core ENVI header fields instead of
  treating header metadata as an ambient object

Work:

- keep the `CubeHeader` contract explicit in `docs/API.md`
- treat future metadata growth as additive fields rather than ad hoc shape drift
- keep normalized band and spatial fields optional until implementation catches
  up

Done when:

1. `getHeader()` is no longer described as a generic object
2. contract tests assert the presence of current core ENVI header fields
3. `docs/API.md` and `docs/DOCUMENTATION_REVIEW.md` agree on the contract

### P0.2 Freeze public compatibility policy

Owner: public API and release policy

Work:

- document the support window for `loadFile(...)`
- keep compatibility aliases explicit rather than accidental
- publish the rule that breaking public changes require migration notes

Done when:

1. `loadFile(...)` support timing is explicit in `docs/API.md`
2. the roadmap carries the same public-stability rule
3. release docs no longer rely on implied compatibility promises

### P0.3 Freeze internal refactor and packaging policy

Owner: roadmap and release policy

Work:

- define which changes are internal-only
- define which changes justify public churn
- keep one-package publication as the default through early `0.x`

Done when:

1. `docs/ROADMAP.md` states the internal-refactor and semver rule
2. `docs/CUBESCOPE_BLUEPRINT.md` stays aligned with the one-package policy
3. packaging decisions no longer rely on oral history

## P1: Boundary Freeze

These tasks turn the key architecture seams into explicit code targets.

### P1.1 Add minimal interface files for core abstractions

Owner: core runtime boundaries

Status note:

- the minimal contract layer is now anchored in
  `src/sources/data-source.js`, `src/formats/format-adapter.js`,
  `src/formats/envi-format-adapter.js`, `src/store/cube-store.js`, and
  `src/rendering/renderer-contract.js`
- the current runtime load path already uses the `DataSource ->
  FormatAdapter -> CubeStore` chain
- renderer decoupling remains part of `P2.1`

Work:

- add minimal internal interfaces for `DataSource`, `FormatAdapter`,
  `CubeStore`, and `Renderer`
- keep the first pass intentionally small; the goal is boundary fixation, not
  package splitting
- adapt the current implementation behind those interfaces incrementally

Done when:

1. interface files exist in code for the four abstractions
2. tests or import-level checks exercise those boundaries
3. `docs/ARCHITECTURE.md` matches the concrete interface floor

### P1.2 Freeze typed worker protocol envelopes

Owner: worker protocol and runtime contracts

Status note:

- typed request and response envelopes now live in
  `src/protocol/worker-protocol.js`
- `src/runtime/viewer-runtime.js` and `src/runtime/viewer-worker.js` now use
  top-level `sourceId` and `requestId` fields instead of burying them inside
  ad hoc payload shapes
- contract tests cover request envelopes, response envelopes, and the
  compatibility alias

Work:

- replace loosely-shaped worker payloads with discriminated request and response
  envelopes
- ensure every worker payload declares enough schema for reconstruction without
  guessing
- keep `sourceId` and `requestId` first-class protocol fields

Done when:

1. protocol messages are typed by command and response kind
2. contract tests cover the envelope shape, not only string constants
3. `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` describe the same protocol rule

### P1.3 Define `cancel` and source-invalidation semantics

Owner: worker runtime and viewer lifecycle

Status note:

- `src/runtime/viewer-runtime.js` now tracks active request ids per source and
  broadcasts `cancel` for the invalidated source on unload, destroy, and source
  switch
- `src/runtime/viewer-worker.js` now suppresses canceled tile, stats, and
  spectrum work and returns workers to the idle pool through a `canceled`
  response
- tests cover request tracking, stale-source detection, and worker-side cancel
  consumption safety

Work:

- define how `cancel` targets request-scoped work
- define what gets cleared on source switch
- keep stale responses from mutating active state or reviving dead caches

Done when:

1. `cancel` behavior is documented for worker and caller responsibilities
2. tests cover stale-response suppression and cancellation safety
3. lifecycle docs and worker docs agree on source-scoped invalidation

## P2: Runtime Decoupling And Ownership

These tasks make the current runtime architecture less fragile before new
capabilities pile on.

### P2.1 Isolate renderer input contract

Owner: renderer boundary

Status note:

- `src/rendering/webgpu-renderer.js` now owns WebGPU draw passes and GPU tile
  resources
- `src/runtime/viewer-runtime.js` now renders through
  `createRendererInput(...)` instead of issuing draw commands directly
- renderer input remains explicitly source-scoped through `sourceId`, `slot`,
  `header`, `viewState`, and visible `tiles`

Work:

- make renderer input explicit and narrow
- stop renderer code from owning source parsing, band choice, or statistics
- preserve renderer-owned GPU cache ownership without leaking upward

Done when:

1. renderer code consumes a defined input shape rather than ambient viewer state
2. tests cover render behavior through that input contract
3. `docs/ARCHITECTURE.md` no longer describes renderer separation as prose only

### P2.2 Implement cache ownership floor

Owner: runtime cache ownership

Status note:

- `src/runtime/source-cache.js` now defines explicit ownership, budget, and
  invalidation policies for metadata, stats, raw-tile, and render-tile caches
- `src/runtime/viewer-runtime.js` now keeps metadata and stats in concrete
  source-scoped caches instead of ambient maps
- `src/rendering/webgpu-renderer.js` now enforces a renderer-owned render-tile
  LRU budget by byte size and tile count per source

Work:

- make metadata and stats caches concretely source-scoped
- define byte budget and invalidation behavior for raw and render tile caches
- keep `unload()` as the public trigger for source-scoped cache teardown

Done when:

1. cache slices declare owner, budget, and invalidation behavior in code
2. tests cover `unload()` and source-switch cache clearing
3. docs and runtime behavior agree on cache semantics

### P2.3 Make GPU disposal and device-loss behavior explicit

Owner: renderer lifecycle

Status note:

- `src/rendering/webgpu-renderer.js` now publishes explicit device-loss
  lifecycle callbacks, tears down GPU resources on loss, and reports renderer
  readiness instead of relying on implicit exceptions
- `src/runtime/viewer-runtime.js` now pauses requeue while the renderer is down
  and performs best-effort WebGPU reinitialization before redrawing the active
  source

Work:

- define disposal behavior for GPU-backed caches
- define what survives device/context loss and what must be rebuilt
- keep source teardown and renderer teardown compatible

Done when:

1. device-loss and disposal rules are visible in code and docs
2. smoke coverage catches obvious renderer teardown regressions
3. the release path can explain renderer ownership without guesswork

### P2.4 Close the runtime shell deliberately

Owner: viewer-core orchestration

Status note:

- `src/runtime/viewer-runtime.js` is no longer a monolithic implementation
  class; most queueing, routing, lifecycle, transition, and draw-loop logic
  now flows through dedicated runtime helpers
- what remains inline is now mostly public-API glue, spectrum request flow,
  cancel/invalidation glue, worker bootstrap, and DOM interaction wiring
- the next wave should resist additional micro-extractions unless a new
  consumer, test gap, or bug pressure proves they are needed

Work:

- document the remaining inline runtime responsibilities explicitly
- stop using vague phrases like "too much orchestration" without naming the
  actual residue
- switch the next execution window back toward alpha gates and visible
  capability work

Done when:

1. docs explicitly name the remaining `viewer-runtime` responsibilities
2. roadmap and architecture docs no longer describe runtime residue only in
   generic terms
3. the next recommended sequence prioritizes release-facing and capability work
   over more controller splitting

## P3: Release-Grade External Verification

These tasks close the remaining gap between local alpha readiness and a public
alpha.

### P3.1 Confirm external CI

Owner: release engineering

Work:

- run GitHub Actions on Node 22 and record the result
- verify the workflow does not rely on hidden local state
- fix CI-only issues before any public tag

Done when:

1. the checklist can mark GitHub Actions complete
2. failure triage rules have been applied consistently
3. roadmap and checklist tell the same external-verification story

### P3.2 Verify external embedding

Owner: packaging and consumer install path

Work:

- create one minimal consumer app outside the current source tree
- install or link `@cubescope/web`
- verify worker and WASM asset loading from a consumer application

Done when:

1. one external embedding path succeeds with evidence
2. the checklist can mark consumer embedding complete
3. the roadmap can claim package embeddability with proof

### P3.3 Keep CI rollback and retry policy explicit

Owner: release policy

Work:

- separate hard blockers from infra-only reruns
- prevent accidental public tagging on ambiguous CI status
- keep the release gate readable for future maintainers

Done when:

1. `docs/ALPHA_RELEASE_CHECKLIST.md` defines hard blockers and retry-only cases
2. public-tag decisions no longer rely on ad hoc judgment
3. release docs stay aligned with actual CI behavior

## P4: Capability Expansion On Frozen Boundaries

These tasks widen the project only after the contract and architecture are less
fragile.

### P4.1 Normalize band metadata and display defaults

Owner: metadata normalization and viewer defaults

Work:

- parse and preserve band names and wavelengths where available
- add room for display roles such as `red`, `green`, `blue`, `nir`, and `gray`
- replace hard-coded high-band assumptions with rule-based defaults

Done when:

1. low-band-count datasets display sensibly without manual band picking
2. tests cover default selection behavior across 1-band, 3-band, and
   low-count multispectral fixtures
3. docs describe the actual defaulting behavior without overclaiming

### P4.2 Add multispectral fixtures

Owner: test data and validation

Work:

- create at least one synthetic visible-light fixture
- create at least one low-band multispectral fixture
- add them to contract or smoke validation where appropriate

Done when:

1. fixture coverage extends beyond the current 32-band synthetic cube
2. validation paths use the new fixtures
3. `test-data/README.md` and reproducibility docs describe them

### P4.3 Normalize spatial metadata and affine mapping inputs

Owner: metadata normalization and geospatial boundary

Status note:

- ENVI `map info` and `coordinate system string` now parse into first-class
  metadata fields in the Rust header model
- `src/formats/cube-header.js` now normalizes those fields into a stable
  `spatialReference` contract with structured `mapInfo` and derived affine
  transforms
- docs now explicitly keep this work bounded to metadata and mapping, not
  renderer reprojection

Work:

- parse ENVI spatial fields such as `map info` and coordinate system strings
- preserve affine transform information even when full CRS conversion is absent
- keep geospatial support bounded to metadata and mapping first

Done when:

1. the metadata model can carry pixel/world mapping inputs without renderer
   logic
2. tests cover the normalized spatial shape
3. docs explicitly defer real-time raster reprojection

### P4.4 Add pixel/world mapping and pixel-space overlays

Owner: geospatial interaction layer

Status note:

- `CubeViewer` and `CubeStore` now expose affine `pixelToWorld(...)` and
  `worldToPixel(...)` helpers for local ENVI sources
- the example app now reports pixel/world probe coordinates after clicks
- overlay proof remains deferred; this task is now mostly about the overlay
  follow-on rather than the core mapping API

Work:

- define `pixelToWorld` and `worldToPixel` around affine transforms
- prove one overlay path that converts world coordinates into pixel-space
  drawing inputs
- do not add full real-time reprojection in the renderer

Done when:

1. projected coordinates can be reported when affine metadata exists
2. one point, line, or polygon overlay path works through pixel space
3. docs preserve the boundary between mapping and reprojection

### P4.5 Introduce the `DataSource` seam in code, then add `HTTP range`

Owner: byte-access and remote-read boundary

Status note:

- the runtime now supports both `envi-local` and `envi-http` through the same
  `DataSource`-based load path
- workers now reconstruct byte sources from serializable descriptors instead of
  assuming direct `File` objects in every request
- the repo now includes a deterministic same-origin HTTP fixture and benchmark
  coverage for both local and `envi-http` paths
- the example app now exposes a registered remote-sample catalog, and local
  validation can exercise that catalog through a dedicated smoke/report path
- a shipped public remote sample now exists, so this task is no longer blocked
  on external ENVI sample availability

Work:

- implement an internal byte-range abstraction instead of relying only on direct
  `File` objects
- keep `envi-local` as the first stable public source kind
- add `HTTP range` support only after the internal seam is real

Done when:

1. the codebase has a concrete seam for local and remote byte access
2. one legally accessible remote ENVI source can be opened without downloading
   the full payload first
3. benchmark and reproducibility docs cover the remote-read path

### P4.6 Keep the canonical docs in lockstep

Owner: documentation integrity

Work:

- update `docs/API.md`, `docs/ARCHITECTURE.md`, and `README.md` when public or
  architectural contracts change
- update `docs/REPRODUCIBILITY.md`, `docs/ALPHA_RELEASE_CHECKLIST.md`, and
  `test-data/README.md` when fixtures or source kinds change
- keep roadmap status tied to code and tests, not intent

Done when:

1. canonical docs describe the same project state
2. no roadmap item is marked complete while code, tests, and docs disagree
3. release and reproducibility docs remain operational

## Recommended Sequence

Use this order unless a blocker forces a local swap:

1. P0.1 freeze `CubeHeader`
2. P0.2 freeze public compatibility policy
3. P0.3 freeze internal refactor and packaging policy
4. P1.1 add minimal interface files
5. P1.2 freeze typed worker protocol envelopes
6. P1.3 define `cancel` and source invalidation semantics
7. P2.1 isolate renderer input contract
8. P2.2 implement cache ownership floor
9. P2.3 make GPU disposal and device-loss behavior explicit
10. P3.1 confirm external CI
11. P3.2 verify external embedding
12. P3.3 keep CI rollback and retry policy explicit
13. P4.1 normalize band metadata and display defaults
14. P4.2 add multispectral fixtures
15. P4.3 normalize spatial metadata and affine mapping inputs
16. P4.4 add pixel/world mapping and pixel-space overlays
17. P4.5 introduce the `DataSource` seam, then add `HTTP range`
18. P4.6 keep the canonical docs in lockstep
