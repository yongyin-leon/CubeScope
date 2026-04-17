# CubeScope Blueprint

## Vision

`CubeScope` is a browser-native hyperspectral cube viewer focused on fast,
zero-install, hardware-accelerated exploration of ENVI datasets, with a design
that can grow into a general spectral data platform.

The project should prioritize:

1. Viewer-first usability
2. Strong performance on large local datasets
3. Clean extension points for analysis algorithms
4. Reproducible research and open-source reuse

## Why This Project Exists

The current open ecosystem has useful tools, but most solutions fall into one
of these buckets:

1. Desktop or scripting-first hyperspectral tools
2. Server-centric scientific visualization systems
3. Full web applications with fixed workflows

CubeScope should instead occupy this space:

> A reusable browser SDK for loading, viewing, probing, and analyzing
> hyperspectral cubes without requiring a heavyweight desktop stack.

## Product Positioning

CubeScope is not initially a full remote sensing workbench.

It is:

1. A viewer kernel
2. A browser SDK
3. A performance-oriented ENVI adapter
4. A foundation for analysis plugins

## Naming

Recommended public naming:

- Project: `CubeScope`
- Tagline: `Browser-native, hardware-accelerated hyperspectral viewer kernel`
- npm scope: `@cubescope/*`
- 0.x public browser SDK: `@cubescope/web`
- future ENVI adapter package, once justified: `@cubescope/formats-envi`
- future analysis packages: `@cubescope/analysis-*`

## Launch Narrative

CubeScope should enter the open-source community with a narrow and memorable
message:

1. browser-native
2. local-first
3. hardware-accelerated
4. embeddable as a viewer kernel

It should not initially market itself as a complete remote sensing workbench or
an all-in-one analysis suite.

## First Public Release Scope

The first solid open-source release should support:

1. ENVI `.hdr + data` loading
2. BIP / BIL / BSQ interleave
3. Pseudo-RGB band selection
4. Pan / zoom / tile rendering
5. Pixel spectral profile inspection
6. Metadata access
7. Background stats caching

The first release should not try to own:

1. Heavy server workflows
2. Deep-learning training pipelines
3. Domain-specific calibration pipelines
4. Collaboration backends

Those should arrive later as plugins or companion apps.

## Post-Alpha Capability Themes

Once the first public alpha is stable, CubeScope should expand in a staged way
rather than by adding every attractive idea at once.

The blueprint owns the product shape, not the implementation order. Sequencing
belongs in `docs/ROADMAP.md`.

Core themes that fit the product:

1. multispectral and visible-light support through normalized band metadata and
   sensible default display logic
2. georeferencing and spatial metadata normalization
3. remote-readable ENVI through `DataSource` and `HTTP range`
4. provenance/export metadata for reproducible downstream use

These upgrades move CubeScope from "browser viewer" toward "scientific
infrastructure" without diluting the viewer-kernel launch message.

### High-value adoption layer after the first public alpha

1. Jupyter / Python notebook bridge built on top of `@cubescope/web`
2. radiometric metadata support that can later drive GPU-side calibration
3. schema and cache design that leaves room for future time-series / 4D cubes

These additions are strategically strong, but they should not block the first
public software-paper release.

### Research-track experiments

1. full `SharedArrayBuffer` / zero-copy pipeline exploration
2. Zarr or other cloud-native multidimensional format support

These are promising differentiators, especially for systems papers, but they
should be pursued as evidence-driven tracks rather than folded into the core
alpha scope by default.

## Long-Term Capability Model

CubeScope should grow in layers:

1. `Format adapters`
2. `Cube storage and data access`
3. `Rendering engines`
4. `Interaction tools`
5. `Analysis runtimes`
6. `Application shells`

This lets the project support both:

- lightweight embedding in another app
- richer first-party demo and research applications

## Monorepo Direction

Recommended target structure:

```text
cubescope/
  crates/
    envi-core/
    cubescope-wasm/
    analysis-core-rs/
  packages/
    protocol/
    datasource/
    formats-envi/
    core/
    renderer-webgpu/
    renderer-webgl/
    analysis-core/
    analysis-basic/
    analysis-advanced/
    web/
    react/
  apps/
    demo/
    benchmark/
    docs-site/
  test-data/
  docs/
```

This is an internal architecture target, not a requirement to publish every
directory as an npm package in the first releases.

## 0.x Packaging Rule

Before `0.3.0-beta`, keep the external release story intentionally small:

1. publish one browser-facing SDK package
2. keep submodules internally separated in the repo, but privately versioned
3. split into finer public packages only when a second adapter, renderer, or
   downstream consumer needs independent semver
4. do not let internal refactors force public package churn by themselves

This reduces release friction while preserving clean internal seams.

## Release Philosophy

Three rules should guide release decisions:

1. The public API must be smaller than the internal API.
2. Demo code must depend on public contracts, not private state.
3. Analysis features must compose through stable interfaces, not ad hoc hooks.
4. Public package count in `0.x` should stay smaller than internal module count.

## Research Fit

CubeScope can support at least three scholarly outputs:

1. A software paper on a browser-native ENVI viewer
2. A systems paper on Rust/WASM + workers + WebGPU performance
3. Domain papers built on analysis plugins and reproducible datasets

## Success Criteria

The project is on the right track when:

1. The core viewer works without the debug/demo extras
2. A small sample cube can be loaded and explored reproducibly
3. Algorithms can be added without editing renderer internals
4. Performance claims are benchmarked, not guessed
5. The project is easy to embed into another web app
