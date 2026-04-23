# Runtime Support Policy

This document defines how CubeScope treats Node.js versions during the
`0.1.0-alpha.x` cycle.

## Short Version

- official release and reproducibility baseline: `Node 22.x`
- acceptable local development runtime: newer Node versions may work
- release gates, reports, and paper-facing reproducibility claims: always
  anchored to `Node 22.x`

## Why `Node 22`

CubeScope currently targets `Node 22.x` because it is the most appropriate
baseline for an alpha-stage open-source SDK that is also being prepared for
software-paper submission.

Reasons:

1. `Node 22` is an LTS line, which makes it a better reproducibility anchor
   than a fast-moving current release.
2. build, test, pack, benchmark, and browser automation are already verified
   locally under `Node 22`.
3. the repository toolchain files (`.nvmrc`, `.node-version`, `package.json`)
   are intentionally aligned to one stable baseline.
4. a paper-oriented software release benefits more from a durable target
   runtime than from chasing the latest Node feature line.

## Why Not Make `Node 25` The Baseline

`Node 25` is not forbidden. It can still be useful for local development or
early compatibility observation.

However, CubeScope does not treat it as the official baseline because:

1. it is a current release rather than the intended long-lived reproduction
   target
2. ecosystem edges can move faster there
3. it would weaken the clarity of the project’s release and paper
   reproducibility story

## Practical Rule

During the current alpha cycle:

1. release checklists, reproducibility docs, and local alpha reports should
   point to `Node 22.x`
2. `npm run verify:node22-local` is the authoritative local runtime check
3. newer Node versions may be used for day-to-day development, but passing on a
   newer runtime does not replace the `Node 22` gate
4. any future `Node 25+` check should be documented as a non-blocking
   compatibility observation unless the project explicitly changes its release
   baseline

## Current Repository Policy

At the time of writing:

- official toolchain target: `Node 22.x`
- official verification command: `npm run verify:node22-local`
- external CI on `Node 22`: deferred until the repository is ready for that
  public-facing gate

If the project later decides to move the official runtime baseline, that change
should be reflected in all of the following in the same update:

- `package.json`
- `.nvmrc`
- `.node-version`
- `docs/REPRODUCIBILITY.md`
- `docs/ALPHA_RELEASE_CHECKLIST.md`
- local verification/report scripts
