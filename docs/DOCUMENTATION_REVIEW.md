# Documentation Review

This document records the current state of the CubeScope documentation set
after the private `0.1.0-alpha.1` consolidation work. Its job is to answer
three questions:

1. which document owns which kind of truth
2. where the current documentation is aligned
3. what still needs to be clarified before the next implementation phase

## Scope

This review covers the following files:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/CUBESCOPE_BLUEPRINT.md`
- `docs/ROADMAP.md`
- `docs/REPRODUCIBILITY.md`
- `docs/ALPHA_RELEASE_CHECKLIST.md`
- `CONTRIBUTING.md`
- `CITATION.cff`
- `test-data/README.md`
- `.github/workflows/ci.yml`

## Current Stage Conclusion

CubeScope is currently best described as a private `0.1.0-alpha.1` release
candidate:

- the repository has moved beyond prototype-only status
- the public browser SDK boundary is defined
- local reproducibility is in place
- the software-paper gate is locally close, but not externally closed until
  GitHub Actions on Node 22 is confirmed, one public remote sample is fixed,
  and the first public tag is created

This means the documentation should optimize for truthfulness and execution
discipline rather than ambitious breadth.

## Canonical Ownership

The documentation set is now strongest when each file has a narrow role.

### `README.md`

Use as the public front door:

- what CubeScope is
- what the alpha does and does not do
- how to install, build, test, and run it
- where the rest of the docs live

It should not carry deep future architecture or long-range research planning.

### `docs/API.md`

Use as the source of truth for the actual alpha contract:

- public constructor and methods
- stable events
- lifecycle guarantees
- explicit non-goals

It should describe real behavior, not aspirational interfaces.

### `docs/ARCHITECTURE.md`

Use as the system design reference:

- core abstractions
- ownership rules
- thread/data-flow rules
- cache model
- migration targets

It should define seams and constraints, not marketing claims.

### `docs/CUBESCOPE_BLUEPRINT.md`

Use as the product and ecosystem positioning document:

- what CubeScope is for
- what it should become over time
- how to explain its scope to users and collaborators

It should remain narrower than the roadmap and less implementation-specific than
the architecture document. It should not own near-term implementation order.

### `docs/ROADMAP.md`

Use as the sequencing and research-planning document:

- current stage assessment
- phase goals
- release plan
- publication tracks
- strategic adoption queue

It should answer "what next" and "why this order".

### `docs/REPRODUCIBILITY.md`

Use as the authoritative rebuild-and-verify path:

- toolchain
- commands
- expected artifacts
- local verification sequence

It should stay short and operational.

### `docs/ALPHA_RELEASE_CHECKLIST.md`

Use as the gate document for the next release decision:

- what is already satisfied
- what still blocks a public alpha

It should reflect current status, not a blank template.

## What Is Aligned Well

The current documentation set is already strong in these areas:

1. the public package identity is consistent around `CubeScope` and
   `@cubescope/web`
2. the alpha API is now described as a real class-based interface instead of a
   speculative factory design
3. reproducibility, citation, issue templates, and contribution guidance now
   exist as a coherent software-paper shell
4. the roadmap no longer understates the current implementation status
5. the architecture doc already captures the most important long-term seams:
   `DataSource`, `FormatAdapter`, `CubeStore`, `Renderer`, and `Analysis Runtime`

## Remaining Documentation Gaps

The next implementation phase should be guided by the following gaps.

### 1. The public header contract is now documented, but the code-facing interface floor is still missing

`docs/API.md` now defines a stable `CubeHeader` shape, which closes the largest
public-contract gap. The remaining issue is that the same boundary is not yet
enforced through concrete internal interface files.

Why it matters:

- feature work should not rely on architecture that exists only in prose
- internal seams need code ownership before they absorb more responsibilities
- downstream tests need a real boundary to target

Next documentation target:

- keep the documented interface floor aligned with the future internal modules

### 2. Renderer input boundaries are clearer in prose than in code

The architecture now states a clear renderer input contract, but the
implementation still carries coupling between renderer, cache, and interaction
logic.

Next documentation target:

- keep renderer decoupling as a first-class near-term task rather than an
  implied cleanup item

### 3. Worker protocol typing and cancellation semantics still need promotion from recommendation to hard requirement

The architecture now distinguishes current worker commands from the next-step
typed envelope and `cancel` semantics, but this remains a boundary to
implement, not yet a completed refactor.

Next documentation target:

- keep protocol typing and request-scoped cancellation ahead of `DataSource`
  expansion and analysis growth

### 4. The release story is stronger than the external verification story

The docs correctly note that local alpha verification has passed. The remaining
gap is not conceptual but procedural:

- GitHub Actions on Node 22 still needs confirmation
- a stable public remote sample beyond the repo-local fixture is still pending

Next documentation target:

- keep these two items clearly visible as blockers for the public alpha tag

### 5. Public-package discipline needs an explicit refactor policy

Because `@cubescope/web` is the only public package, internal refactors can
accidentally spill public churn unless the semver and packaging rule is
documented.

Next documentation target:

- keep refactor and public-package policy visible in the roadmap and blueprint

## Documentation Decisions For The Next Phase

The next phase should proceed with these documentation rules:

1. `README.md` stays narrow and release-facing
2. `docs/API.md` should remain the first place where public compatibility rules
   are frozen
3. `docs/ARCHITECTURE.md` should define internal boundaries before more feature
   work lands
4. `docs/CUBESCOPE_BLUEPRINT.md` should describe product identity, not task
   order
5. `docs/ROADMAP.md` should drive feature order, release order, and refactor
   policy
6. heavy ideas such as real-time reprojection or `SharedArrayBuffer`
   zero-copy should stay marked as research tracks until evidence justifies
   promotion

## Immediate Outcome Of This Review

Based on the current documentation set, the next implementation wave should
focus on:

1. freezing `CubeHeader` and public compatibility policy
2. freezing the internal interface floor and worker protocol semantics
3. isolating renderer input and cache ownership
4. closing external verification gates
5. only then widening capability through multispectral, geospatial, and
   `HTTP range`

The task breakdown for that work is tracked separately in
`docs/NEXT_DEVELOPMENT_TASKS.md`.
