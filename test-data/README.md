# Test Data

CubeScope ships deterministic synthetic ENVI fixtures for alpha validation.

## Primary Fixture

- id: `cubescope-mini-cube`
- dimensions: `48 x 48 x 32`
- format: `ENVI BSQ`
- data type: `uint16`
- byte order: `LSB`
- spatial metadata: `map info` + `coordinate system string`
- reference coordinate: `(500000, 4100000)` with `30m x 30m` pixels
- generation script: `npm run fixtures:generate`
- license: `MIT`

## Boundary Fixtures

The fixture generator also emits layout variants with the same deterministic
pixel formula:

- `cubescope-mini-cube-bil`: `ENVI BIL`
- `cubescope-mini-cube-bip`: `ENVI BIP`

These variants are used to exercise `FormatAdapter` and `CubeStore` read-model
boundaries across the three supported ENVI interleave layouts. The original
`cubescope-mini-cube` BSQ fixture remains the smoke and benchmark baseline.

The fixture exists to support:

- automated smoke tests
- baseline benchmark automation
- reproducible local validation without redistributing external data
- deterministic same-origin `HTTP range` validation through `public/fixtures/`

The generated files live under `test-data/fixtures/`.
The same generated files are also mirrored to `public/fixtures/` so the demo,
smoke tests, and benchmarks can exercise the remote-read path without relying
on an external server.
