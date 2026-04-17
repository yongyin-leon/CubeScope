# CubeScope Roadmap

## Goal

Turn the current prototype into an open-source, analysis-ready viewer platform
without losing the performance advantages already present in the Rust/WASM +
worker design.

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
- separate `viewer core` from `renderers`
- define `DataSource`, `FormatAdapter`, `CubeStore`, `Renderer`
- move debug panels to demo app
- expose stable events and methods only

### Exit criteria

- the viewer works without demo-only panels
- demo depends only on public interfaces

## Phase 2: Packaging and Compatibility

### Objectives

1. Make the project embeddable
2. Improve browser portability
3. Improve build reproducibility

### Tasks

- publish modular packages under `@cubescope/*`
- add WebGL fallback renderer
- add local file and HTTP range data sources
- add CI for Rust/WASM + package build
- add browser integration tests

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

### `0.1.0-alpha`

- docs and branding
- repo cleanup
- first cut of package boundaries

### `0.2.0-alpha`

- core viewer extraction
- typed worker protocol
- stable ENVI viewing path

### `0.3.0-beta`

- public SDK
- demo app split
- fallback renderer

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

- public wrapper: `src/EnviViewer.js`
- viewer core and orchestration: `src/lib/hsi-wasm.js`
- worker runtime: `src/lib/worker.js`
- Rust/WASM parsing and extraction: `rust/envi_parser_Improved/src/*`
- example app and debug tooling: `examples/*`, `src/debug-panel.js`,
  `src/SystemMonitorPanel.js`, `src/PerformanceMonitorRust.js`

Current strengths:

- local ENVI viewing path already exists
- BIP / BIL / BSQ are already handled
- heavy work is offloaded to workers
- WebGPU rendering path already exists
- pixel spectral probing is already possible
- basic performance instrumentation already exists

Current liabilities:

- public API and demo behavior are not yet aligned
- renderer, scheduler, cache, and interaction logic are tightly coupled
- debug and performance tooling still live too close to core code
- worker messages are not yet formal typed contracts
- build reproducibility needs work
- benchmarks, fixtures, and tests are not yet publication-grade

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

- package boundary for `@cubescope/web`
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
