# Remote Sample Workflow

This document defines how CubeScope should qualify a truly public remote ENVI
sample before it is added to the shipped sample catalog.

## Goal

The public remote-sample path should only admit sources that work with the real
browser-facing `envi-http` contract:

1. the `.hdr` must be directly fetchable
2. the `.img` must support byte-range reads
3. browser CORS must allow direct fetches from a CubeScope demo origin
4. the dataset license and provenance must be clear enough to document publicly

## Current Shipped Baseline

The repository now ships two remote-sample tiers:

- catalog file: `public/samples/remote-samples.json`
- deterministic local sample id: `repo-local-http`
- shipped public sample id: `snowex-aviris-ng-sasp`

The local tier proves the code and packaging boundary. The public tier proves a
real third-party browser-visible host and should continue to be treated as an
external validation surface rather than a deterministic local fixture.

## Qualification Checks

Before a public sample is added to the shipped catalog, run:

```bash
npm run qualify:sample -- \
  --id candidate-id \
  --title "Candidate Title" \
  --header-url "https://example.com/path/to/file.hdr" \
  --data-url "https://example.com/path/to/file.img"
```

The candidate is only eligible when the generated report shows:

1. `evaluation.headerReachable = true`
2. `evaluation.rangeOkay = true`
3. `evaluation.corsOkay = true`
4. `evaluation.browserEligible = true`

Output is written to `output/samples/<id>-qualification.json`.

## One-Command Candidate Validation

CubeScope now provides a single command that chains:

1. preview catalog generation
2. transport/CORS qualification
3. browser validation through the real demo path

```bash
npm run validate:sample-candidate -- \
  --id candidate-id \
  --title "Candidate Title" \
  --header-url "https://example.com/path/to/file.hdr" \
  --data-url "https://example.com/path/to/file.img"
```

The command writes:

- a temporary preview catalog under `public/samples/`
- a qualification report under `output/samples/`
- a combined candidate-validation summary under `output/samples/`

For local deterministic checks, relative paths such as `/fixtures/...` are also
accepted; the script will start a local dev server, resolve the sample URLs
against that origin, and then reuse the same origin for browser validation.

The preview catalog is removed automatically after validation unless
`--keep-preview` is passed explicitly.

## Preview Catalog Generation

Before touching the shipped catalog, generate a candidate catalog file:

```bash
npm run create:sample-catalog -- \
  --id candidate-id \
  --title "Candidate Title" \
  --header-url "https://example.com/path/to/file.hdr" \
  --data-url "https://example.com/path/to/file.img" \
  --output public/samples/remote-samples.preview.json
```

Then validate that preview catalog through the real browser path:

```bash
CUBESCOPE_SAMPLE_CATALOG_URL=/samples/remote-samples.preview.json \
CUBESCOPE_REGISTERED_SAMPLE_ID=candidate-id \
npm run validate:samples
```

This lets CubeScope validate a public candidate without editing the shipped
`public/samples/remote-samples.json` file first.

## Promotion Rules

After a candidate passes qualification:

1. generate and validate a preview catalog first
2. add it to `public/samples/remote-samples.json`
3. keep the sample URLs absolute if the asset host is external
4. set `availability` to `public`
5. set `validationTier` to `public`
6. keep the deterministic local sample in place; do not replace it
7. rerun local validation and then run the public-tier validation path

## Current External Candidate Notes

As of `2026-04-23`, the shipped public sample is:

- source: GitHub `snowex-hackweek/tutorial-data`
- file pair:
  - `SnowEx-2022/AVIRIS-NG/ang20210411t181022_rfl_v2z1a_img_SASP.hdr`
  - `SnowEx-2022/AVIRIS-NG/ang20210411t181022_rfl_v2z1a_img_SASP`
- shipped sample id: `snowex-aviris-ng-sasp`
- result:
  - direct header fetch: reachable
  - byte-range GET: returns `206`
  - browser CORS: allowed (`Access-Control-Allow-Origin: *`)
  - public-tier browser validation: passed

An earlier investigated candidate remains useful as a negative example:

- source: Zenodo `HyPyRameter Test Data`
- result:
  - direct header fetch: reachable
  - byte-range GET: returns `206`
  - browser CORS: not observed in the probe response
- conclusion: promising as a data source, but not browser-eligible for the
  shipped `envi-http` public catalog without a host-side CORS change
