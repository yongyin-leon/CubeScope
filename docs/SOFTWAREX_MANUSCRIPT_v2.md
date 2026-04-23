# CubeScope: a browser-native, local-first viewer kernel for ENVI hyperspectral datasets

## Title page draft

Article type: `Original software publication`

Authors: `[To be completed]`

Affiliations: `[To be completed]`

Corresponding author: `[To be completed]`

## Abstract

CubeScope is a browser-native viewer kernel for ENVI hyperspectral datasets.
The software addresses a gap between heavyweight desktop or server-centered
remote-sensing environments and lightweight web image viewers by providing
local-first, embeddable interaction with multi-band image cubes in modern
browsers. CubeScope combines a Rust/WebAssembly ENVI parser, Web Workers for
background loading and tile-oriented runtime work, and a hardware-accelerated
rendering path that prefers WebGPU while retaining a verified WebGL
compatibility fallback. The current alpha release supports local ENVI loading,
HTTP range-backed remote ENVI access, normalized cube metadata, spectral
probing, affine pixel-to-world coordinate mapping from ENVI spatial metadata,
and explicit runtime packaging for worker and WebAssembly assets. To support
reuse and evaluation, the repository also provides deterministic test fixtures,
public sample validation, benchmark commands, browser smoke tests, packaging
checks, and release-gating reports anchored to a reproducible Node 22
toolchain. CubeScope is intentionally scoped as an embeddable viewer kernel
rather than a full analysis platform, allowing downstream web applications to
integrate hyperspectral browsing without adopting a heavyweight backend stack.

## Keywords

`hyperspectral`; `ENVI`; `visualization`; `WebGPU`; `WebAssembly`;
`remote-sensing`; `scientific-software`

## 1. Software overview

Hyperspectral workflows are often shaped by desktop applications, notebook
scripts, or server-centered geospatial systems. These approaches remain useful,
but they can be cumbersome when the need is fast browser-based inspection,
lightweight sharing, or integration into a custom scientific web interface.
Many teams can process hyperspectral data offline, yet still lack a reusable
browser-side viewer that preserves format semantics and supports practical
interaction.

CubeScope addresses this gap as a viewer kernel rather than as a complete
analysis platform. The current software artifact focuses on browser-native,
local-first ENVI viewing with a small embeddable API, validated rendering
paths, and reproducibility-oriented release practice. This scope is narrow on
purpose: the present contribution is not a full remote-sensing workbench, but a
reusable foundation for scientific web applications that need hyperspectral
viewing.

The public package is `@cubescope/web`, and the main public class is
`CubeViewer`. The primary loading contract is `load(source)`, with two current
source modes: `envi-local` for paired local files, and `envi-http` for remote
ENVI data served with browser-visible `CORS` and `HTTP range`. Within this
scope, the alpha already supports pseudo-RGB viewing, band switching,
normalized header access, spectral probing, and pixel/world coordinate mapping
when ENVI spatial metadata is present.

Several capabilities remain deliberately outside the present scope. CubeScope is
not yet a general GIS engine, not a broad multi-format ecosystem, and not a
complete analysis suite. Its current spatial capability stops at metadata
normalization and affine mapping, while rendering remains in source pixel
space. This boundary helps keep the software contribution clear and credible.

## 2. Architecture and functionality

CubeScope is organized as a layered browser software stack. The public SDK
exposes a compact class-based interface. Beneath that surface, a viewer runtime
coordinates loading, events, workers, view updates, and renderer interaction.
Below the runtime, data access and format-specific services translate raw source
bytes into normalized cube metadata and read operations. Rendering then
consumes prepared raster and view state rather than direct source-format
details. Around this runtime sits a reproducibility and release-validation
layer, which includes fixtures, smoke tests, browser-matrix reporting,
benchmarks, packaging checks, and alpha summaries.

The main architectural seams are `DataSource`, `FormatAdapter`, `CubeStore`,
`Renderer`, and the runtime orchestration shell. `DataSource` is responsible for
byte access only, currently through local file/blob reads and an HTTP-range
remote path. `FormatAdapter` interprets ENVI source bytes, parses metadata, and
supports tile and spectrum extraction. `CubeStore` exposes normalized metadata
and cube-oriented services such as tile reads, spectrum reads, and
pixel/world mapping. `Renderer` consumes prepared raster layers and view state
and is explicitly separated from source parsing and format semantics.

The implementation combines Rust/WebAssembly, Web Workers, and browser GPU
rendering in a practical way. ENVI parsing is anchored in a Rust/WebAssembly
component that serves as the authoritative parser layer for the current format
support. Background work is routed through Web Workers using explicit message
envelopes and source-aware request tracking, which helps isolate stale work when
sources change. Rendering is WebGPU-first but retains a validated WebGL
compatibility path. In `auto` mode, the viewer prefers WebGPU but can recover
through WebGL after a device-loss event, including cases where the browser
requires the render canvas to be recreated before a new graphics context can be
used.

Spatial support follows a conservative but useful boundary. ENVI `map info` and
`coordinate system string` fields are normalized into
`CubeHeader.spatialReference`, and where possible the software derives an affine
transform that powers `pixelToWorld()` and `worldToPixel()`. This supports
coordinate-aware inspection without forcing the renderer to perform full
coordinate reference system conversion or real-time reprojection.

## 3. Availability, packaging, and quality control

Reproducibility is treated as part of the software contribution. CubeScope uses
Node `22.x` as the official release and reproducibility baseline, while newer
Node versions may still be used for local development. In the current validated
local environment, the repository was checked under Node `v22.22.2`, npm
`10.9.7`, and a Rust toolchain with the `wasm32-unknown-unknown` target plus
`wasm-bindgen-cli 0.2.100`.

The validation workflow is repository visible and command-oriented. A
reproducible local run starts with dependency installation and deterministic
fixture generation, then proceeds through Rust/WASM rebuilding, browser-SDK
building, contract tests, browser smoke tests, browser-matrix reporting,
benchmark collection, sample validation, package-consumer verification, and
alpha summary reporting. These steps generate machine-readable evidence under
`output/`, including benchmark results, browser-matrix results, sample reports,
pack-consumer verification, and a consolidated alpha status snapshot.

CubeScope also uses a dual-sample strategy. The repository ships a small,
deterministic synthetic ENVI fixture for repeatable smoke tests and benchmarks,
and it now includes one validated public remote ENVI sample,
`snowex-aviris-ng-sasp`, which is exercised through the browser-facing
`envi-http` workflow. Candidate public samples are not added informally; they
must pass a qualification and validation workflow that checks both transport
behavior and browser usability.

Packaging checks reinforce the embeddability claim. An isolated consumer
verification step confirms that the packaged tarball exports the expected public
surface and includes the required runtime assets, including the ES module
bundle, worker bundle, WebAssembly parser files, validation fixtures, sample
catalog, and citation metadata.

## 4. Illustrative usage and early evaluation

The simplest CubeScope workflow is local ENVI loading. A downstream application
creates a `CubeViewer`, initializes it, and calls
`load({ kind: 'envi-local', ... })` with the header and data files. Once
loaded, the viewer exposes normalized metadata, renders a pseudo-RGB view,
allows band switching, and returns a spectral profile for pixel inspection.

The same viewer contract also supports remote ENVI access through `HTTP range`.
In that case the source is described by `headerUrl` and `dataUrl` rather than
local file handles. This path still depends on browser-visible `CORS` and
`HTTP range`, but it allows a web application to interact with ENVI data
without first downloading the full data object eagerly.

The current evaluation is a software-release check rather than a full systems
benchmark study. The goal is to show that browser-native hyperspectral
interaction is practical and reproducible. Benchmark reports were generated in a
macOS environment using Node `v22.22.2`, Chromium `147.0.7727.15`, and a
deterministic ENVI fixture with dimensions `48 x 48 x 32`.

The benchmark harness records three early metrics: header parse time, time to
initial view, and band-switch time. In the local-file scenario, the measured
values are approximately `12.5 ms`, `23.2 ms`, and `7.6 ms`, respectively. In
the same-origin remote scenario using `HTTP range`, the values are
approximately `10.4 ms`, `36.7 ms`, and `31.1 ms`. These are reported as
direct validation outputs, not as polished comparative benchmarks.

The browser-matrix report adds evidence for renderer behavior. In the current
local Chromium verification, both a forced `webgl` scenario and an `auto`
scenario passed. In the `auto` scenario, the recorded renderer state shows an
observed transition from `webgpu` to `webgl` after a device-loss event, with
the session completing in a recovered state. This is not yet a broad browser or
hardware comparison, but it does show that the compatibility path is exercised
through an actual browser workflow.

## 5. Impact and limitations

CubeScope lowers the barrier to browser-based hyperspectral viewing. Users and
teams do not need to adopt a heavyweight remote backend or a full desktop
analysis environment simply to inspect ENVI data in a browser. This makes the
software relevant for exploratory work, review interfaces, annotation tools,
quality-control utilities, and educational applications.

The project also has reuse value beyond the repository demo. Because CubeScope
is packaged as a viewer kernel with explicit runtime assets and an embeddable
public API, it can serve as infrastructure for downstream scientific web
applications. The current release also establishes a stable architectural base
for later work on multispectral support, richer spatial overlays, additional
source formats, and lightweight analysis plugins.

The limitations are equally important to state clearly. The software is
currently ENVI-first rather than broadly multi-format. The main artifact is a
browser SDK, so users working only in Python or desktop environments still need
an integration layer. The remote workflow depends on compatible `CORS` and
`HTTP range` behavior at the serving endpoint. The benchmark scope is
intentionally narrow and should not be mistaken for a full comparative systems
study. Finally, the current alpha is not yet a complete scientific analysis
environment.

## 6. Conclusions

CubeScope shows that browser-native hyperspectral viewing can already be
packaged as serious research software without waiting for a full remote-sensing
analysis platform. The current alpha provides a reproducible, embeddable ENVI
viewer kernel built around a Rust/WebAssembly parser, worker-oriented runtime
execution, and hardware-accelerated browser rendering with a validated fallback
path. It pairs that runtime with fixtures, public-sample validation, packaging
checks, benchmark commands, and release-gating reports that improve inspection,
reuse, and citation potential.

Within its current scope, CubeScope already contributes a meaningful software
base for downstream web applications that need hyperspectral viewing without a
heavy backend stack. Near-term work should widen capability carefully through
multispectral support, richer spatial overlays, additional source adapters, and
later analysis-oriented extensions.

## Data availability

No new experimental data were generated for this software paper. The repository
includes deterministic validation fixtures, benchmark outputs, browser-matrix
reports, sample-validation reports, and packaging-verification artifacts as part
of the software release and reproducibility workflow.

## Acknowledgements

`[To be completed]`

## Funding

`[To be completed. If none: This research did not receive any specific grant from funding agencies in the public, commercial, or not-for-profit sectors.]`

## CRediT author statement

`[To be completed]`

## Declaration of competing interest

The authors declare that they have no known competing financial interests or
personal relationships that could have appeared to influence the work reported
in this paper. `[Revise if needed before submission.]`

## Declaration of generative AI and AI-assisted technologies in the manuscript preparation process

`[To be completed according to final author decision and journal policy before submission.]`

## Software availability

Repository: `[Public repository URL to be inserted before submission]`

Version: `0.1.0-alpha.1` or later tagged release to be archived for submission

License: `MIT`

## References

`[To be completed]`
