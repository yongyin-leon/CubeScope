# CubeScope Roadmap

## Goal

Turn the current prototype into an open-source, analysis-ready viewer platform
without losing the performance advantages already present in the Rust/WASM +
worker design.

## Current Stage Assessment (2026-04-23)

CubeScope is no longer at the repository-hygiene-only stage. It is currently in
a private `0.1.0-alpha.1` local release-candidate state:

- Phase 0 is complete
- Phase 1 is largely complete at the public-contract level
- Phase 2 has started, with packaging, test, and benchmark infrastructure in
  place
- local consumer-app embedding verification is now complete through the tarball
  install/import gate
- external GitHub Actions verification on Node 22 is deferred for now and
  remains a later public-release gate rather than an active local blocker

What this means in practice:

1. the project is already software-paper-oriented and locally reproducible
2. the project is not yet beta, because broader public-release gates such as
   external CI and repository opening are still deferred
3. the project is not yet in Phase 3 analysis work, even though spectral probe
   functionality already exists

## Near-Term Execution Rule (2026-04)

The next implementation window should be boundary-first rather than
feature-first:

1. freeze the public contract, especially `CubeHeader`
2. freeze the internal interface floor for `DataSource`, `FormatAdapter`,
   `CubeStore`, and renderer input
3. isolate worker protocol typing, cancellation, renderer input, and cache
   ownership semantics
4. close external release gates
5. only then widen capability through multispectral, geospatial, and remote
   data access

This order reduces the risk that attractive feature work hardens accidental
coupling.

## Runtime Baseline Policy

CubeScope currently uses a two-level Node policy:

1. official release and reproducibility baseline: `Node 22.x`
2. newer Node versions may still be used for local development and
   compatibility observation
3. release gates, alpha reports, and software-paper-facing reproducibility
   claims remain anchored to `Node 22.x`

This keeps the project aligned with an LTS runtime without forbidding local
exploration on newer Node lines.

## Internal Refactor And Semver Policy

While `@cubescope/web` is the only public package, internal refactors must not
create avoidable public churn.

1. purely internal moves, extractions, and file reorganization do not justify a
   public API change by themselves
2. additive public capabilities should arrive as additive fields, events, or
   methods whenever possible
3. breaking public changes require explicit migration notes even during `0.x`
4. deprecated public APIs must be announced at least one minor release before
   removal
5. public package splits happen only when a second adapter, renderer, or
   downstream consumer genuinely needs independent semver

## Strategic Adoption Queue (2026-04)

The following strategic ideas are worth adopting, but not at the same priority
or risk level. They should be staged so they strengthen the alpha-to-paper path
instead of delaying it.

### Do Now: next execution priority after `0.1.0-alpha.1`

1. freeze the public header contract and internal interface floor
   - reason: downstream capabilities now depend more on boundary quality than
     raw feature count
   - target phase: late Phase 1 into early Phase 2
   - expected paper value: strengthens reproducibility and architectural
     credibility for a software paper
2. multispectral and visible-light support through normalized band metadata and
   default display logic
   - reason: this broadens the user base without breaking the viewer-kernel
     strategy
   - target phase: Phase 2
   - expected paper value: strengthens the software-paper story as reusable
     remote-sensing software rather than hyperspectral-only tooling
3. harden the remote ENVI path after the first `HTTP range` landing
   - reason: the capability now exists, so the next value comes from public
     sample documentation, benchmark stability, and clearer release gating
   - target phase: Phase 2
   - expected paper value: strengthens both the software paper and later
     systems baselines
4. geospatial follow-on after the affine-mapping slice
   - reason: initial ENVI spatial metadata normalization and pixel/world
     mapping now exist, so the next geospatial work should focus on overlays,
     richer sources, and later CRS conversion without disturbing renderer
     boundaries
   - target phase: late Phase 2 onward
   - expected paper value: improves credibility as remote-sensing software
5. provenance and export metadata
   - reason: publication-grade software needs reproducible outputs, not only
     interactive viewing
   - target phase: Phase 2 into early Phase 3
   - expected paper value: supports SoftwareX/JOSS reuse claims and later
     domain collaboration

### Do After Public Alpha: important, but should not block the first open tag

1. Jupyter / Python bridge
   - reason: this is a major adoption multiplier for scientific users, but it
     depends on the browser SDK being stable first
   - target phase: after the first public alpha
   - expected paper value: significantly improves software-paper usability and
     citation potential
2. radiometric calibration metadata pipeline
   - reason: gain/offset/reflectance metadata should enter the format and store
     model before the renderer owns real-time calibration
   - target phase: late Phase 2 into Phase 3
   - expected paper value: sets up a genuinely scientific rendering story
3. reserved 4D/time-series dimension support
   - reason: the architecture should avoid locking itself into a strict
     `(x, y, band)` worldview even if full 4D support is deferred
   - target phase: schema and cache-key preparation in Phase 2, implementation
     later
   - expected paper value: improves long-range research credibility without
     forcing near-term complexity

### Research Track: valuable, but treat as a separate experiment stream

1. full end-to-end zero-copy pipeline with `SharedArrayBuffer`
   - reason: this is high upside but high coordination cost, and should not be
     the default correctness path
   - target phase: Track B experimentation
   - expected paper value: strong systems paper potential if benchmark evidence
     is decisive
2. Zarr / cloud-native multidimensional formats
   - reason: strategically important, but only after `HTTP range` ENVI proves
     the core remote-read model
   - target phase: post-Phase 2 ecosystem expansion
   - expected paper value: broadens long-term scientific reach

## Phase 0: Repository Hygiene

### Objectives

1. Make the repository understandable
2. Reduce accidental coupling
3. Prepare for open-source release

### Tasks

- choose and document the public name `CubeScope`
- unify license metadata across files
- create `docs/` architecture and API docs
- separate generated artifacts from source ownership
- identify minimal legal sample datasets
- add `CITATION.cff`
- add issue templates and contribution docs

### Exit criteria

- a new contributor can understand the repo in under 15 minutes
- the source-of-truth modules are obvious

## Phase 1: Core Viewer Extraction

### Objectives

1. Preserve current ENVI viewer capability
2. Separate core from demo
3. Freeze a small public API

### Tasks

- extract Rust ENVI parsing into `envi-core`
- create typed worker protocol
- define the minimum concrete interface floor for `DataSource`,
  `FormatAdapter`, `CubeStore`, and renderer input
- define explicit `cancel` semantics for request-scoped worker work
- document zero-copy / transferable ownership rules for large buffers
- define cache budgets, eviction, and invalidation rules
- separate `viewer core` from `renderers`
- define `DataSource`, `FormatAdapter`, `CubeStore`, `Renderer`
- move debug panels to demo app
- expose stable events and methods only

### Progress Snapshot (2026-04-23)

- completed: demo-only panels moved under `examples/demo/*`
- completed: wrapper now exposes stable aliases for `header`, `bandschange`, runtime `updateConfig()`, and `unload()`
- completed: typed worker request/response envelopes landed in `src/protocol/worker-protocol.js`, with `sourceId` and `requestId` promoted to first-class fields
- completed: worker request/response envelopes now carry an explicit
  `protocolVersion`, and unsupported versions are rejected before runtime
  state mutation
- completed: `load({ kind: 'envi-local', headerFile, dataFile })` is now the primary public load entry, with `loadFile(...)` kept as compatibility alias
- completed: runtime request tracking and worker-side `cancel` suppression now define explicit source invalidation behavior for tile, stats, and spectrum work
- completed: stale worker responses are isolated by `sourceId`, and source-scoped caches reset on source switch
- completed: contract tests cover source normalization, worker protocol envelopes, and wrapper event aliases
- completed: browser smoke automation verifies example startup, synthetic fixture load, initial render, and a `performance` event
- completed: WebGPU draw passes and GPU tile resource caches now flow through
  `src/rendering/webgpu-renderer.js` using explicit renderer input
- completed: source-scoped metadata/stats cache ownership is codified in
  `src/runtime/source-cache.js`, and renderer-owned render-tile caches now
  enforce byte/tile budgets with explicit GPU disposal and device-loss recovery
- completed: viewport state, transition-slot state, and render-slot promotion
  now flow through `src/runtime/render-session.js`, reducing how much
  orchestration detail lives inline inside `src/runtime/viewer-runtime.js`
- completed: worker idle-pool state plus tile/stats/preload queue bookkeeping
  now flow through `src/runtime/work-scheduler.js`, reducing another layer of
  source-scoped orchestration detail in `src/runtime/viewer-runtime.js`
- completed: worker envelope normalization and response classification now flow
  through `src/runtime/worker-message-router.js`, reducing how much protocol
  decoding logic still lives inline inside `src/runtime/viewer-runtime.js`
- completed: stats completion, tile completion, and tile error reaction
  planning now flow through `src/runtime/runtime-reaction-plan.js`, reducing
  how much post-route state-reaction logic still lives inline inside
  `src/runtime/viewer-runtime.js`
- completed: tile/stats/preload dispatch loops now flow through
  `src/runtime/runtime-work-executor.js`, reducing how much worker execution
  loop logic still lives inline inside `src/runtime/viewer-runtime.js`
- completed: source teardown, metadata summary creation, and renderer
  device-loss recovery now flow through
  `src/runtime/runtime-lifecycle-controller.js`, reducing how much lifecycle
  orchestration still lives inline inside `src/runtime/viewer-runtime.js`
- completed: band-switch planning, transition kickoff, and transition frame
  finalization now flow through `src/runtime/runtime-transition-controller.js`,
  reducing how much transition orchestration still lives inline inside
  `src/runtime/viewer-runtime.js`
- completed: canvas resize, visible-tile calculation, and draw-loop
  scheduling now flow through `src/runtime/runtime-view-controller.js`,
  reducing how much view-update orchestration still lives inline inside
  `src/runtime/viewer-runtime.js`
- completed: renderer input now carries explicit `tileSize`, removing the
  historical renderer-side `512` tile-size assumption from WebGPU and WebGL
- completed: outgoing worker request ids, envelopes, and payload shaping now
  flow through `src/runtime/worker-dispatch-policy.js`, reducing how much
  dispatch construction logic still lives inline inside `src/runtime/viewer-runtime.js`
- completed: raw worker lifecycle management now flows through
  `src/runtime/worker-pool.js`, reducing how much init, broadcast, and
  termination logic still lives inline inside `src/runtime/viewer-runtime.js`
- completed: initial-load timing, band-switch timing, band-stats readiness,
  and preload planning now flow through `src/runtime/runtime-policy.js`,
  reducing how much runtime policy state still lives inline inside
  `src/runtime/viewer-runtime.js`
- completed: `CubeHeader` normalization now flows through
  `src/formats/cube-header.js`, fixing `interleave`, `dataType`, and
  `byteOrder` into a stable public metadata contract
- completed: `CubeViewer.getPixelProbe(...)` now exposes a JSON-safe probe
  snapshot for pixel/world/spectrum provenance and demo export paths
- next focus: close release-facing reproducibility and metadata gates without
  widening the public API

### Exit criteria

- the viewer works without demo-only panels
- demo depends only on public interfaces
- memory and cache contracts are documented, not implicit

## Phase 2: Packaging and Compatibility

### Objectives

1. Make the project embeddable
2. Improve browser portability
3. Improve build reproducibility

### Tasks

- keep internal modules package-ready, but publish one browser SDK through the
  early `0.x` cycle
- add WebGL fallback renderer
- add local file and HTTP range data sources
- add CI for Rust/WASM + package build
- add browser integration tests

### Progress Snapshot (2026-04-23)

- completed: external release surface has been reduced to one ESM browser SDK, `@cubescope/web`
- completed: `dist/` is no longer treated as source-of-truth material
- completed: Rust/WASM rebuilds are scriptable from source and copied into the published runtime asset layout
- completed: Node 22, npm, Rust/WASM, Playwright, and benchmark commands are documented for reproducibility
- deferred: GitHub Actions confirmation on Node 22 remains outside the current private alpha window
- completed: ENVI spatial metadata now normalizes into a stable
  `spatialReference` contract, and the public viewer exposes affine
  `pixelToWorld(...)` / `worldToPixel(...)` helpers without introducing
  reprojection into the renderer
- completed: install-from-another-app verification of the packaged SDK now
  passes through `npm run verify:pack`
- completed: the source-based API now supports remote ENVI loading through
  `load({ kind: 'envi-http', headerUrl, dataUrl, headers? })`, and workers now
  consume serializable `DataSource` descriptors instead of assuming raw `File`
  objects
- completed: the repo now ships a deterministic same-origin HTTP fixture path
  through `public/fixtures/`, and benchmark/smoke automation can exercise both
  local and `envi-http` flows without an external dependency
- completed: a registered remote-sample catalog now lives under
  `public/samples/remote-samples.json`, and local validation can exercise that
  catalog through a dedicated command and demo auto-load path
- completed: the repo now includes a candidate-qualification command for future
  public remote samples, so external hosts can be screened for range and CORS
  before they are added to the shipped catalog
- completed: a WebGL compatibility renderer now exists behind the renderer
  seam, and local smoke / benchmark verification can force that path for
  deterministic browser validation
- completed: the auto renderer now degrades the current viewer session from
  WebGPU to WebGL after device loss, so recovery does not keep retrying an
  unstable adapter in `auto` mode
- completed: a local Chromium browser-matrix report now records observed
  renderer behavior for both `rendererPreference=webgl` and
  `rendererPreference=auto` against the deterministic local fixture
- completed: the browser-matrix report now records requested browsers,
  verified browsers, optional skipped scenarios, and required failures instead
  of implying untested compatibility
- completed: local Playwright browser installation now verifies Chromium,
  Firefox, and WebKit WebGL paths against the deterministic fixture, with
  Chromium additionally exercising `auto` WebGPU-to-WebGL recovery
- completed: the runtime now recreates the render canvas when a browser requires
  a fresh drawing context to recover from WebGPU into the WebGL compatibility
  path during auto-renderer recovery
- completed: one stable public remote sample beyond the repo-local HTTP
  fixture now ships in the sample catalog and passes the public-tier browser
  validation path
- pending: repeat this browser-matrix evidence in public CI or external
  browser-lab runs once the repository is public

### Exit criteria

- another app can install and embed `@cubescope/web`
- browser fallback behavior is documented and tested

## Phase 3: Analysis Foundation

### Objectives

1. Add analysis without bloating core
2. Create a durable plugin model
3. Make viewer outputs reusable as analysis inputs

### Tasks

- create `analysis-core`
- define algorithm contracts
- implement first-party basic algorithms:
  - spectral profile
  - ROI mean spectrum
  - percentile stretch
  - band math
  - SAM
  - PCA projection
- add analysis result layers
- add provenance metadata for each analysis run

### Exit criteria

- an analysis plugin can be added without touching renderer internals
- analysis results can be visualized as layers or exported

## Phase 4: Performance and Benchmarking

### Objectives

1. Replace intuition with evidence
2. Support software publication and performance claims

### Benchmark tracks

1. header parse time
2. time to initial view
3. band switch time
4. tile throughput by interleave type
5. memory footprint
6. worker scaling behavior
7. WebGPU vs WebGL comparison
8. JS-only vs Rust/WASM comparison
9. server-preprocessed tile workflow vs direct local loading

### Exit criteria

- benchmark app exists
- fixtures and commands are reproducible
- results can be cited in docs or a paper

## Phase 5: Advanced Analysis and Ecosystem Growth

### Objectives

1. Support broader scientific use cases
2. Allow specialized downstream extensions

### Candidate features

- ROI management and annotation
- spectral library matching
- anomaly detection
- endmember extraction
- dimensionality reduction variants
- classification hooks
- remote analysis jobs
- geospatial overlays
- notebook and Python interop bridges

### Exit criteria

- advanced features live in plugins or companion packages
- the core viewer remains small and stable

## Release Plan

### `0.1.0-alpha.1` (current private alpha candidate)

- single `@cubescope/web` SDK identity
- source-based ENVI loading for `envi-local` and `envi-http`
- ENVI spatial metadata normalization plus affine pixel/world mapping
- typed worker protocol and contract tests
- reproducible local build, smoke, and benchmark path
- citation, contribution, issue, and release-checklist shell
- shipped public remote-sample catalog plus public-tier validation artifact
- Node 22 confirmation on a matching local runtime

### `0.2.0-alpha`

- first public tag and repository opening
- stronger internal split between viewer core and renderer/store responsibilities
- optional external CI once the repository is ready for that gate

### `0.3.0-beta`

- broader browser compatibility story
- auto-renderer hardening across the browser / GPU matrix

### `0.4.0-beta`

- analysis-core
- first-party basic analysis plugins

### `1.0.0`

- stable SDK
- benchmark publication
- reproducible fixtures
- polished docs site

## Research Roadmap

### Paper 1: Software paper

Focus:

- browser-native ENVI viewer
- architecture
- reproducibility

### Paper 2: systems/performance paper

Focus:

- Rust/WASM vs JS
- workers
- WebGPU vs WebGL
- interleave-aware access patterns

### Paper 3: domain application paper

Focus:

- geology, agriculture, medical, inspection, or environmental workflows
- analysis plugins built on CubeScope

## Open-Source and Publication Execution Plan

This section turns the roadmap above into a practical program for building
CubeScope into a recognizable open-source research software project and a
publication pipeline.

## Current Repository Baseline

The current repository already contains the seed of the eventual platform:

- public wrapper: `src/cube-viewer.js`
- viewer core and orchestration: `src/runtime/viewer-runtime.js`
- worker runtime: `src/runtime/viewer-worker.js`
- Rust/WASM parsing and extraction: `rust/envi-parser/src/*`
- example app and demo tooling: `examples/*`, `examples/demo/*`

Current strengths:

- local ENVI viewing path already exists
- remote ENVI viewing through deterministic same-origin `HTTP range` now exists
- BIP / BIL / BSQ are already handled
- heavy work is offloaded to workers
- WebGPU rendering path already exists
- WebGL compatibility rendering now exists through the renderer seam
- pixel spectral probing is already possible
- ENVI spatial metadata and affine pixel/world mapping are already possible
- basic performance instrumentation already exists
- typed worker envelopes and source-based load entry already exist
- reproducible fixture generation, smoke testing, and benchmark commands now exist
- isolated tarball consumer verification now exists
- package metadata, citation metadata, issue templates, and contribution docs are in place

Current liabilities:

- the remaining inline `viewer-runtime` shell still owns public-API glue,
  spectrum request flow, cancel/invalidation glue, worker bootstrap, and DOM
  interaction wiring; that residue is now narrower, but it should stay visible
  in reviews
- the internal seam floor now exists, and render-session extraction has
  reduced viewer-runtime pressure, and work-scheduler extraction has reduced
  queue-state pressure, and worker-message-router extraction has reduced
  protocol branching pressure, and runtime-reaction-plan extraction has
  reduced post-route state-reaction pressure, and runtime-work-executor
  extraction has reduced dispatch-loop pressure, and
  runtime-lifecycle-controller extraction has reduced source/recovery
  lifecycle pressure, and runtime-transition-controller extraction has reduced
  transition-flow pressure, and runtime-view-controller extraction has reduced
  view-update pressure, and worker-dispatch-policy extraction has reduced
  request-construction pressure, and worker-pool extraction has reduced
  worker-lifecycle pressure, and runtime-policy extraction has reduced
  timing/preload pressure, but state reactions and side effects still own too
  much orchestration detail
- one stable public remote sample beyond the repo-local HTTP fixture is now
  documented and shipped in the sample catalog
- the auto renderer still needs broader browser-matrix hardening, especially
  for WebGPU recovery in unstable headless environments; current local reports
  verify Chromium, Firefox, and WebKit WebGL behavior and Chromium auto recovery
- Node 22 on a matching local runtime has now been confirmed before the first
  public alpha tag

## Strategic Thesis

CubeScope should not present itself as a generic "all-in-one hyperspectral
platform" at the start.

The strongest near-term position is:

> CubeScope is a browser-native, local-first, embeddable hyperspectral viewer
> kernel for ENVI data, designed as open research software and built around
> Rust/WASM, workers, and modern browser rendering.

That thesis is stronger than broader but weaker claims such as:

- a universal remote sensing workbench
- an AI-first analysis platform
- a replacement for every desktop hyperspectral tool

## Innovation Focus

The project should concentrate its novelty claims around a combination of:

1. browser-native, zero-install exploration of local ENVI cubes
2. SDK-first design rather than a single monolithic demo app
3. interleave-aware data access for BIP / BIL / BSQ
4. measurable systems performance through Rust/WASM + workers + WebGPU
5. open, reproducible benchmarking and software release practice

Claims to avoid:

1. "first open-source hyperspectral software"
2. "best hyperspectral viewer" without benchmark evidence
3. broad scientific-analysis claims before the analysis layer is stable

## Publication Program

CubeScope should pursue a three-paper progression rather than trying to combine
software, systems, and domain science into one overloaded paper.

### Track A: software paper

Primary objective:

- establish CubeScope as citable research software

Core contribution:

- browser-native ENVI viewing software
- architecture and package boundaries
- reproducibility and open-source engineering practice

Publication readiness requirements:

- public repository with clear license
- archived release and citation metadata
- stable minimal API
- reproducible demo and benchmark instructions
- at least one documented public dataset or legal test fixture

Priority note:

> Track A should not wait for the full analysis stack. A stable embeddable
> viewer kernel plus reproducible release practice is enough to justify the
> first submission.

### Track B: systems/performance paper

Primary objective:

- demonstrate that browser-native hyperspectral interaction is technically
  serious rather than a lightweight demo

Core contribution:

- Rust/WASM vs JS comparison
- worker scaling behavior
- interleave-aware access performance
- WebGPU vs WebGL or fallback renderer comparison
- latency metrics such as time-to-initial-view and band-switch time

Publication readiness requirements:

- stable benchmark harness
- fixed benchmark fixtures
- repeated runs on declared hardware/browser matrix
- clear baselines and statistical reporting
- at least one JS-only reader baseline
- at least one server-side preprocessed or pyramid-style workflow baseline

### Track C: domain application paper

Primary objective:

- show scientific value in a real workflow once the platform is mature

Core contribution:

- domain-specific use case built on CubeScope
- repeatable workflow with analysis plugins
- evidence that the software improves interpretability, throughput, or
  reproducibility for that workflow

Publication readiness requirements:

- real collaborator or domain dataset
- validated workflow, not just a synthetic demo
- mature export and provenance support

## Recommended Journal Strategy

### Near-term target set

For the software-first paper, prioritize journals that explicitly value open
research software and reusable scientific tooling.

Candidate lane:

1. software paper first
2. systems/performance paper second
3. domain application paper third

Suggested fit:

- `SoftwareX` for the software product itself
- `JOSS` for a leaner software-focused publication path
- `Computers & Geosciences` for geoscience-facing computing and visualization
- later, depending on the scientific story, a domain journal for the
  application paper

The software paper should not wait for the full analysis platform. The systems
paper should wait until benchmark methodology is stable. The domain paper should
wait until there is a real scientific collaboration.

## Twelve-Month Execution Plan

### Months 0-3: foundation for open-source release

Goals:

- make the repository legible
- make the build reproducible
- define the first stable software surface

Deliverables:

- fix build reproducibility and dependency ownership
- identify source-of-truth code vs generated artifacts
- publish contribution guide, citation file, and release policy
- freeze a minimal viewer API for ENVI local loading
- create typed worker protocol draft
- write the memory/data-flow and cache-eviction contract
- prepare benchmark fixture set and one legal public demo dataset
- separate demo-only documentation from core package documentation

Research outputs in this window:

- paper outline for the software paper
- figure list and benchmark plan

### Months 3-6: core extraction and first alpha release

Goals:

- make the core viewer stand on its own
- reduce accidental coupling to demo-only modules

Deliverables:

- extract Rust ENVI parser into explicit core ownership
- move demo/debug panels behind public contracts
- split viewer core from renderer-facing code where practical
- release `0.1.0-alpha` or `0.2.0-alpha`
- archive release and generate citation metadata
- publish architecture diagram and API guarantees

Research outputs in this window:

- full draft of the software paper
- reproducibility appendix draft

### Months 6-9: embeddable SDK and benchmark system

Goals:

- prove CubeScope can be embedded in another app
- turn performance claims into measured results

Deliverables:

- one stable public browser SDK package
- browser integration tests
- benchmark app or benchmark command suite
- renderer abstraction sufficient for fallback work
- first public benchmark report

Research outputs in this window:

- software paper submission
- systems paper experiment matrix locked

### Months 9-12: analysis minimum and systems paper

Goals:

- add the smallest serious analysis layer without bloating core
- publish the systems story with evidence

Deliverables:

- minimal `analysis-core`
- at least a few first-party algorithms such as spectral profile, ROI mean
  spectrum, and band math
- layer model sufficient to render analysis outputs
- provenance model for analysis runs
- systems/performance paper draft

Research outputs in this window:

- systems/performance paper submission
- shortlist of domain collaborators for paper 3

## Release Gates for a Publishable Project

### Gate 1: software-paper-ready release

Must have:

- stable installation path
- stable minimal API
- reproducible demo steps
- clear architecture document
- citable release
- benchmark commands, even if early

Current status:

- locally satisfied; the remaining future public-release gates are external CI
  confirmation and the eventual public tag/repo switch

### Gate 2: systems-paper-ready release

Must have:

- benchmark fixtures under version control or documented download sources
- declared browser and hardware matrix
- automated measurement pipeline
- fallback or comparison baselines
- repeatable figures and tables

### Gate 3: domain-paper-ready release

Must have:

- plugin-capable analysis layer
- exportable artifacts and provenance
- domain workflow validated with collaborators

## Evidence Package Required for Publication

Every serious submission should be backed by:

1. public source repository
2. tagged release archive
3. clear software license
4. `CITATION.cff`
5. benchmark fixture manifest
6. reproducibility script or command list
7. architecture diagram
8. API contract documentation
9. example application or hosted demo
10. issue tracker and contribution instructions

## Collaboration Plan

The project should seek collaborators in two layers:

### Layer 1: software and systems collaborators

- Rust/WASM contributors
- browser graphics contributors
- geoinformatics or scientific software engineering collaborators

This layer helps with the software and systems papers.

### Layer 2: domain collaborators

- geology
- agriculture
- environmental monitoring
- medical or industrial inspection

This layer is necessary for the later application paper.

The application paper should only start once at least one partner can provide a
real dataset, a real task, and a real evaluation question.

## Success Metrics

Project success should be measured with a mix of software and research metrics.

Software metrics:

- reproducible release cadence
- issues resolved by external contributors
- successful embedding in another application
- benchmark regressions tracked over time

Research metrics:

- first citable software release
- software paper submission and acceptance
- systems benchmark report and follow-on paper
- reuse by external labs or projects

## Priority Rules

When tradeoffs appear, prefer:

1. stable architecture over fast feature accumulation
2. reproducible evidence over informal performance claims
3. public contracts over demo-only convenience
4. one strong software paper over three weak partially finished papers
5. one strong public SDK over premature package proliferation
