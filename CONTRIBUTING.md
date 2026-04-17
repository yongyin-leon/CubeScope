# Contributing To CubeScope

Thanks for helping shape CubeScope.

## Ground Rules

- keep the public browser SDK small
- do not couple demo-only UI back into the core viewer
- do not add new public API without updating docs and tests
- treat large binary copies as a performance bug unless proven otherwise

## Local Development

```bash
npm ci
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.100
npm run fixtures:generate
npm run build
npm run test
```

## Pull Request Expectations

Before opening a pull request:

1. run `npm run build`
2. run `npm run test`
3. update documentation if public behavior changes
4. include benchmark notes for any performance claim

## Scope Discipline

For `0.x`, prefer:

- one clear public SDK over many packages
- reproducibility over broad feature growth
- contract tests over informal manual verification
