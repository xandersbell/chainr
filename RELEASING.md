# Releasing

This project uses [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) with GitHub Actions OIDC. No tokens or secrets are required.

## Steps

1. Update the `version` field in `package.json`
2. Commit the change:
   ```bash
   git commit -am "chore: bump version to x.y.z"
   ```
3. Create and push a tag:
   ```bash
   git tag vx.y.z
   git push origin main --tags
   ```

The `publish.yml` workflow will automatically build and publish to npm when a `v*` tag is pushed.

## First-time Setup

The following has already been configured:

- npm package `priorai` published manually for initial registration
- Trusted publisher linked on npmjs.com: `xandersbell/priorai` → `publish.yml`
