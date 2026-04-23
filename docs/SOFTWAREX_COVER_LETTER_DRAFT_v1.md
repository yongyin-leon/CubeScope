# SoftwareX Cover Letter Draft v1

Date: `2026-04-23`

To the Editors of `SoftwareX`,

Please consider our manuscript, tentatively titled
`"CubeScope: a browser-native, local-first viewer kernel for ENVI hyperspectral datasets"`,
for publication as an `Original software publication` in `SoftwareX`.

CubeScope is a browser-native software package for viewing ENVI hyperspectral
datasets in modern web applications. The software is designed as a reusable
viewer kernel rather than a monolithic analysis platform. Its current alpha
release combines a Rust/WebAssembly ENVI parser, worker-based runtime
orchestration, and hardware-accelerated rendering with a WebGPU-first path and
validated WebGL fallback. The software currently supports local ENVI loading,
HTTP range-backed remote ENVI access, normalized metadata exposure, spectral
probing, affine pixel-to-world mapping, and explicit runtime packaging for
worker and WebAssembly assets.

We believe the manuscript is a strong fit for `SoftwareX` because the
contribution is fundamentally software-oriented. The paper focuses on reusable
scientific software, architecture, packaging, and reproducibility rather than on
presenting a new remote-sensing algorithm. The repository includes citation
metadata, a deterministic validation fixture, a validated public remote sample,
benchmark commands, browser smoke checks, browser-matrix evidence, and package
verification from an isolated downstream consumer environment. In our view,
these characteristics align well with SoftwareX's emphasis on citable,
inspectable, and reusable research software.

The current manuscript is intended as the first software-focused publication in
a broader research trajectory. It establishes the viewer kernel and its
reproducible release practice without waiting for a larger analysis platform.
That scope is deliberate. We believe the present software artifact is already
useful to researchers and developers who need browser-native hyperspectral
viewing inside scientific web workflows, and that this makes it appropriate for
SoftwareX as a standalone software contribution.

At the time of submission, we plan to provide:

- a public repository URL for the software package
- the tagged release associated with the manuscript
- citation metadata and license information
- the manuscript, highlights, and graphical abstract materials required by the
  journal

This manuscript is not under consideration elsewhere. All authors will approve
the submitted version and the associated submission metadata. Any funding,
conflict-of-interest, CRediT, and generative-AI disclosure statements will be
provided in the final submission package as required by the journal.

Thank you for your consideration.

Sincerely,

`[Corresponding Author Name]`

`[Affiliation]`

`[Email]`

`[Postal address]`
