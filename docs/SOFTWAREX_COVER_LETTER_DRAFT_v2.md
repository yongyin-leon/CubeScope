# SoftwareX Cover Letter Draft v2

Date: `2026-04-23`

To the Editors of `SoftwareX`,

Please consider our manuscript,
`"CubeScope: a browser-native, local-first viewer kernel for ENVI hyperspectral datasets"`,
for publication as an `Original software publication` in `SoftwareX`.

CubeScope is a browser-native software package for viewing ENVI hyperspectral
datasets in modern web applications. The software is intentionally designed as
an embeddable viewer kernel rather than as a monolithic analysis platform. Its
current alpha release combines a Rust/WebAssembly ENVI parser, worker-based
runtime orchestration, and hardware-accelerated rendering with a WebGPU-first
path and a validated WebGL compatibility fallback. The software currently
supports local ENVI loading, HTTP range-backed remote ENVI access, normalized
metadata exposure, spectral probing, affine pixel-to-world mapping, and
explicit runtime packaging for worker and WebAssembly assets.

We believe the manuscript is a strong fit for `SoftwareX` because the
contribution is fundamentally software-oriented. The paper focuses on reusable
scientific software, architecture, release engineering, and reproducibility
rather than on introducing a new remote-sensing algorithm. The repository
includes citation metadata, deterministic validation fixtures, a validated
public remote sample, benchmark commands, browser smoke checks, browser-matrix
evidence, package-consumer verification, and a local alpha release summary
anchored to a reproducible Node 22 baseline.

The manuscript is intentionally scoped. It does not present CubeScope as a
complete remote-sensing analysis environment. Instead, it presents a reusable
browser-native ENVI viewer kernel with a clear extension path toward richer
spatial overlays, multispectral support, and additional source adapters. We
believe this narrower and more explicit software contribution matches the aims
of `SoftwareX`, which emphasize inspectable and reusable research software.

At the time of submission, we plan to provide:

- a public GitHub repository URL for the software package
- the tagged release associated with the manuscript
- license and citation metadata
- the manuscript in the required journal template
- the declarations, data statement, and any optional highlights or graphical
  abstract materials retained for submission

This manuscript is not under consideration elsewhere. All authors will approve
the submitted version and the associated submission metadata. Funding,
conflict-of-interest, authorship, CRediT, and any generative-AI disclosure
statements will be finalized in the submission package in accordance with the
journal's requirements.

Thank you for your consideration.

Sincerely,

`[Corresponding Author Name]`

`[Affiliation]`

`[Email]`

`[Postal address]`

`[Phone number]`
