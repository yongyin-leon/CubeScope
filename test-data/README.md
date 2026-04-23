# Test Data

CubeScope ships one deterministic synthetic ENVI fixture for alpha validation.

## Fixture

- id: `cubescope-mini-cube`
- dimensions: `48 x 48 x 32`
- format: `ENVI BSQ`
- data type: `uint16`
- byte order: `LSB`
- spatial metadata: `map info` + `coordinate system string`
- reference coordinate: `(500000, 4100000)` with `30m x 30m` pixels
- generation script: `npm run fixtures:generate`
- license: `MIT`

The fixture exists to support:

- automated smoke tests
- baseline benchmark automation
- reproducible local validation without redistributing external data
- deterministic same-origin `HTTP range` validation through `public/fixtures/`

The generated files live under `test-data/fixtures/`.
The same generated files are also mirrored to `public/fixtures/` so the demo,
smoke tests, and benchmarks can exercise the remote-read path without relying
on an external server.
