# Repository Guidelines

## Project Structure & Module Organization
This repository is a `pnpm` monorepo targeting Node 20+. Main application code lives in `packages/`: `client` (React + Vite web UI), `server` (Hono/Node backend), `shared` (cross-package types and protocol code), `relay` (remote relay service), `desktop` and `mobile` (Tauri shells), plus device-side packages such as `android-device-server` and `device-bridge`. Marketing site code is in `site/`, Cloudflare worker code is in `sharing-worker/`, reusable scripts are in `scripts/`, and longer design notes live in `docs/`.

## Build, Test, and Development Commands
Install once with `pnpm install`.

- `pnpm dev` starts the local stack; default app URL is `http://localhost:3400`.
- `pnpm build` builds all workspace packages.
- `pnpm lint` runs Biome checks across the repo.
- `pnpm format` applies Biome formatting.
- `pnpm typecheck` runs workspace TypeScript checks.
- `pnpm test` runs unit/integration suites across packages.
- `pnpm test:e2e` runs the client Playwright suite.
- `pnpm --filter @yep-anywhere/server test:e2e` runs server E2E tests only.
- `pnpm site:dev` and `pnpm site:build` work on the Astro site.

## Coding Style & Naming Conventions
Biome is the source of truth for formatting and import ordering. Use 2-space indentation, double quotes, and semicolons. Prefer TypeScript throughout the workspace. Match existing file patterns: React components and classes use `PascalCase`, helpers and hooks use `camelCase`, and tests end in `.test.ts`, `.test.tsx`, or Playwright `.spec.ts`. Keep shared contracts in `packages/shared` instead of duplicating types between client and server.

## Testing Guidelines
Vitest is used for package tests; Playwright covers browser flows in `packages/client/e2e`. Place unit tests near the code (`src/__tests__`) or under package-level `test/` directories, following current package conventions. There is no published coverage gate, so contributors should add or update tests for every behavior change and run the narrowest relevant suite locally before opening a PR.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit subjects such as `Fix streaming edit patch filenames` and `Refine PTY read rendering`. Follow that style: capitalized summary, no conventional-commit prefix required. PRs should include a concise description, linked issue or doc when applicable, test notes (`pnpm test`, `pnpm test:e2e`, etc.), and screenshots or recordings for UI changes. Keep release, site, and desktop changes scoped so package-specific CI remains easy to review.
