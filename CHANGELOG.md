# Changelog

All notable changes to this project are documented here. Format loosely follows Keep a Changelog; versions use SemVer.

## [1.0.0] — 2026-10-21

First public release: the complete "custom session groups" feature set on top of DSH's own session browser.

### Added

- **Custom groups mode** (P2): a fourth entry in the sidebar's *View options* menu, stored under `localStorage["dsh.sessionGroups.v1"]`,
  with grouped/ungrouped sections, per-group sections and live updates.
- **Group management** (P3a): create, rename (dialog / F2 / double click), move up/down, delete with confirmation, zh/en locale keys.
- **Drag & drop** (P3b): assign by dropping a session on a group header or into a group, detach by dropping back on *Untitled group*,
  drop-target highlighting, ordering inside a group.
- **Pinned section** (P4a): pinned sessions are lifted out of groups into their own collapsible section, never duplicated, not draggable.
- **Row "⋯" menu grouping** (P4b): *Move to group…* (picker dialog) and *Remove from custom group*, shown according to current assignment.
- **Keyboard & a11y** (P4c): group headers are focusable (`tabIndex`), Enter/Space collapse, F2 rename, Shift+F10 opens the menu with
  roving focus and arrow/Home/End navigation, Esc cancels, focus ring, `aria-expanded`/`aria-label`/`aria-haspopup`/`aria-hidden` complete.
- **Per-group paging** (P4d): watermark `Show N more sessions` / `Show less`, `aria-expanded` follows the state, dragging over a collapsed
  header auto-expands it after 600 ms.
- **Install & packaging**: `scripts/install.mjs` (link install, `--dry-run`/`--check`/`--remove`/`--json`, timestamped backups,
  idempotent), MIT `LICENSE`/`NOTICE`, GitHub Actions CI (build + artifact diff + verify, syntax check), README (zh/en), screenshots.
- **Docs**: environments guide (`docs/13-environments.md`) and known-issues register (`docs/14-known-issues.md`), plus release/rollback manual (`docs/12`).

### Verification

- `node scripts/build.mjs` → `lib/client.js` byte-identical to the committed artifact (7 patches, 267,425 B).
- `node scripts/verify.mjs` → PASS (11 checks), including offline mode (snapshot hash self-check).
- `node scripts/e2e.mjs` → S1–S9, 17 assertions passed, 0 console errors.
- Each stage was additionally validated with an isolated DSH instance on port 3099 driven over CDP (see `docs/07-roadmap.md`).

### Known limitations

See `docs/14-known-issues.md` (upstream version binding, single session-browser slot, localStorage-only data, restart required, etc.).
