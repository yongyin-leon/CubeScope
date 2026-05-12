# SoftwareX Cover Letter Draft v2

Date: `2026-05-12`

To the Editors of `SoftwareX`,

Please consider our manuscript,
`"CubeScope: a browser-native, local-first viewer kernel for ENVI hyperspectral datasets"`,
for publication as an `Original software publication` in `SoftwareX`.

CubeScope is a browser-native software package for viewing ENVI hyperspectral
datasets in modern web applications. The software is intentionally designed as
an embeddable viewer kernel rather than as a monolithic analysis platform. Its
current alpha release combines a Rust/WebAssembly ENVI parser, worker-based
runtime orchestration, and hardware-accelerated rendering with a
WebGPU-preferred path and a validated WebGL compatibility fallback. The software currently
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

- the public GitHub repository URL for the software package:
  `https://github.com/yongyin-leon/CubeScope`
- the tagged release associated with the manuscript:
  `https://github.com/yongyin-leon/CubeScope/releases/tag/v0.1.0-alpha.1`
- the Zenodo software archive DOI:
  `https://doi.org/10.5281/zenodo.20131367`
- license and citation metadata
- the manuscript in the required journal template
- the declarations, data statement, and any optional highlights or graphical
  abstract materials retained for submission

This manuscript is not under consideration elsewhere. All authors will approve
the submitted version and the associated submission metadata. Funding,
conflict-of-interest, authorship, CRediT, and generative-AI disclosure
statements are included in the manuscript draft and can be adjusted in the
submission system if required.

Thank you for your consideration.

Sincerely,

`Yongyin Li`

`107 Geological Team, Chongqing Bureau of Geology and Mineral Development, Chongqing 401120, People's Republic of China`

`[Email]`

`107 Geological Team, Chongqing Bureau of Geology and Mineral Development, Chongqing 401120, People's Republic of China`

`[Phone number]`
