# Playable Wedding RPG — Locked Specification Pack

This specification defines the greenfield replacement for the old `playable-wedding-pixel-quest` scene-based renderer.

## Local folder layout

Keep both implementations side-by-side:

```text
playable wedding inv/
├── pixel old/    # existing repo / reference only
└── pixel new/    # greenfield RPG implementation
```

Do not rewrite `pixel old` in place.

## Scaffold

From the parent folder:

```bash
mkdir "pixel new"
cd "pixel new"
pnpm create @phaserjs/game@latest apps/web
```

When the Phaser installer asks for a framework/template, choose the current official **Next.js + TypeScript** option if available in the installed CLI.

The game runtime is Phaser 4. The React/Next shell owns non-game UI. Do not implement the RPG world as React DOM scenes.

Target repository shape:

```text
pixel new/
├── apps/
│   ├── web/                  # Next/React shell + Phaser mount + admin
│   └── realtime/             # Cloudflare Worker + Durable Object
├── packages/
│   ├── contracts/            # shared Zod/types/protocol
│   ├── game/                 # Phaser world runtime
│   └── wedding-core/         # portable domain services migrated from old
├── assets-source/
│   ├── tiled/
│   ├── tilesets/
│   ├── sprites/
│   └── audio/
├── docs/
└── tooling/
```

## Locked runtime stack

- Phaser 4
- TypeScript
- React / Next.js web shell
- Tiled-authored orthogonal tilemaps
- Cloudflare Workers
- Cloudflare Durable Objects for realtime wedding rooms
- WebSockets with Hibernation API where supported
- Neon PostgreSQL for durable relational data
- Cloudflare Hyperdrive where appropriate
- Cloudflare R2 for media/game assets
- Drizzle retained where portable and useful
- Zod runtime validation
- Playwright for browser/E2E/multi-client testing

## Required documents

Read in this order:

1. `LOCKED_DECISIONS.md`
2. `WORLD_DESIGN.md`
3. `RPG_GAMEPLAY_SPEC.md`
4. `PHASER_ARCHITECTURE.md`
5. `REALTIME_PROTOCOL.md`
6. `ADMIN_RPG_CONFIG.md`
7. `MIGRATION_PLAN.md`

No coding agent may start gameplay implementation before reading all seven.
