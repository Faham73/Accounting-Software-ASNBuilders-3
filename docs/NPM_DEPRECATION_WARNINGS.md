# npm Deprecation Warnings During Install

## What you're seeing

During `npm install` (locally or on Vercel) you may see warnings like:

- `npm warn deprecated rimraf@3.0.2`
- `npm warn deprecated glob@7.2.3`
- `npm warn deprecated tar@6.2.1`
- etc.

## Are they a problem?

**No.** These are **warnings**, not errors. They come from **transitive dependencies** (dependencies of your dependencies, e.g. Next.js, Prisma, or their sub-dependencies). Your build and app still work.

## Why they appear

The packages (rimraf, glob, npmlog, tar, etc.) are used by older versions of tools in the dependency tree. Until those upstream packages update, the warnings will stay. You don’t need to fix them for the project to run.

## Optional: quieter install logs

If you want fewer messages in the log (e.g. on Vercel), you can:

1. **Ignore them** – Safest. Build and deploy are unaffected.
2. **Reduce npm log level** – In Vercel, set **Install Command** to:
   ```bash
   npm install --loglevel error
   ```
   This only hides non-error output; deprecation warnings may still appear depending on npm version.
3. **Overrides** – You can try forcing newer versions of deprecated packages via `overrides` in the root `package.json`. This can break the build if a dependency expects the old version, so only use if you’re prepared to test and revert.

## Summary

- Safe to ignore.
- Build and deployment are not blocked.
- To reduce log noise, use `--loglevel error` in the install command if you prefer.
