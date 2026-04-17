# Test Data

CubeScope ships one deterministic synthetic ENVI fixture for alpha validation.

## Fixture

- id: `cubescope-mini-cube`
- dimensions: `48 x 48 x 32`
- format: `ENVI BSQ`
- data type: `uint16`
- byte order: `LSB`
- generation script: `npm run fixtures:generate`
- license: `MIT`

The fixture exists to support:

- automated smoke tests
- baseline benchmark automation
- reproducible local validation without redistributing external data

The generated files live under `test-data/fixtures/`.
