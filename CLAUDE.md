# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: an online platform to play retro arcade games and compete for high scores. UI copy is in Spanish. The project follows Spec Driven Design (`/spec` and `/spec-impl` skills from `Klerith/fernando-skills`, installed via `npx skills@latest add Klerith/fernando-skills`).

## Skills
Usa siempre /frontend-design para diseñar la interfaz del usuario

## Language conventions

Chat replies are in Spanish. File names, identifiers and code in the project are in English, even though the prototype in `references/templates/` uses Spanish names (`biblioteca`, `salon`, `reproductor`). User-facing UI text stays in Spanish.

## Commands

```bash
npm run dev     # next dev
npm run build   # next build
npm run start   # next start
npm run lint    # eslint (flat config, eslint.config.mjs)
```

No test runner is configured.

## Next.js version warning

`AGENTS.md` states this Next.js (16.x, React 19) differs from what you may know. Read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) before writing Next.js code. Notable things already in use:

- `next.config.ts` enables `cacheComponents`, `partialPrefetching` and `experimental.agentFeedback`.
- Tailwind v4 is wired through Turbopack: a `*.css` rule uses `@tailwindcss/turbopack` (no PostCSS config). Theme tokens live in `app/globals.css` under `@theme inline`.
- Typed route props are global helpers, e.g. `LayoutProps<"/">` in `app/layout.tsx`.
- Path alias `@/*` maps to the repo root.

## Architecture

- `app/` is the real app (App Router). It is still the `create-next-app` scaffold: `app/page.tsx` is the default starter page and `app/layout.tsx` still has the default metadata.
- `references/templates/` is a **design reference**, not part of the build: a standalone prototype (`Arcade Vault.html`, `styles.css`, and `*.jsx` loaded with in-browser Babel and React 18 UMD). It is the source of truth for the intended UI and should be ported to Next.js/React components, not imported.
  - Screens: `biblioteca` (game library), `detalle` (game detail), `reproductor` (player), `auth`, `salon` (hall of fame), plus `nav`, and `data.jsx` (mock `GAMES` list with id, title, cat, cover, color, best, plays).
  - `app.jsx` shows the prototype's behavior: hash-based routing (`{name, id}` JSON in `location.hash`), the user in `localStorage` key `av_user`, and scores appended to `av_scores`. This is mock persistence that a real implementation would replace.
  - `styles.css` (~950 lines) holds the retro neon design tokens and the cover art classes (`cover-bricks`, `cover-tetro`, `cover-snake`, ...). Fonts: Press Start 2P, Courier Prime, JetBrains Mono.
