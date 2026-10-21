# dsh-session-groups · custom session groups for DSH

[![CI](https://github.com/Xian-debu/dsh-session-groups/actions/workflows/ci.yml/badge.svg)](https://github.com/Xian-debu/dsh-session-groups/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)
[![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.2-blueviolet.svg)](https://github.com/deepseek-ai)

A fourth grouping mode for the **DeepSeek Harness (DSH)** web session sidebar: create your own groups, drag sessions in and out, manage them from the keyboard, and collapse or page through each group. Grouping is **display-only** — it never reorders sessions on disk and never uploads anything.

> Unofficial plugin. This repository forks DSH's own `@deepseek-ai/dsh-client-ui-workspace` (MIT) and replaces only the "session browser" slot; everything else is kept verbatim.

> Chinese documentation: [README.md](README.md)

![Custom groups in the sidebar](docs/images/overview.png)

*(Screenshot uses demo session titles, not real data.)*

## Features

- **Fourth grouping mode** — *Custom groups* sits next to the official "by workspace / by time / ungrouped" options and can be switched away at any time.
- **Your own groups** — create, rename (F2 / double click / menu), reorder, delete (with confirmation).
- **Drag & drop** — drop a session on a group header (or inside a group) to assign it; drop it back on *Untitled group* to detach. Reordering inside a group also works.
- **Row "⋯" menu** — *Move to group…* opens a picker dialog, *Remove from custom group* detaches in one click; items appear only when they make sense.
- **Pinned section** — pinned sessions get their own section, take precedence over grouping, never appear twice, and cannot be dragged into a group.
- **Collapse & paging** — collapsible group headers; large groups page with *Show N more sessions* / *Show less*.
- **Keyboard accessible** — Tab to a group header, Enter/Space to collapse, F2 to rename, Shift+F10 to open the menu, arrows/Home/End inside it, Esc to cancel.
- **Plays well with the host** — search, archived filters, pinning, manual ordering, zh/en locales and aria attributes are preserved.

![Group actions menu](docs/images/group-menu.png)

![Move to group dialog](docs/images/move-dialog.png)

## Relationship to other open-source projects

| Project | Relationship |
| --- | --- |
| `@deepseek-ai/dsh-client-ui-workspace` | **Upstream.** Its `lib/client.js` (232,668 B / 5,354 lines) is vendored here and rebuilt from 7 patches. MIT, original attribution kept. |
| DeepSeek Harness | **Host.** Injected through the profile's `dsh.profile.bundles`; nothing inside the DSH installation is modified. |
| Other local DSH plugins (dsh-ops, dsh-skill-hub, …) | **Independent.** They register their own slots; this one occupies the single `sidebar.workspaces` slot only. |

## Requirements

| Item | Requirement | Notes |
| --- | --- | --- |
| DSH | `0.2.1-rc.2` (verified) | Upstream layout changes between releases — re-vendor and rebuild after upgrading, see [docs/13](docs/13-environments.md) |
| Node.js | `>= 22` | Build scripts and plugin runtime |
| Platform | Linux / macOS / WSL2 | Native Windows should work but is untested |
| Browser | any modern browser | The e2e smoke test needs a local Chrome/Chromium |

## Quick start

```bash
git clone https://github.com/Xian-debu/dsh-session-groups.git
cd dsh-session-groups

node scripts/build.mjs      # pristine + patches -> lib/client.js
node scripts/verify.mjs     # 11 checks: upstream sha, patch coverage, inject list, …

node scripts/install.mjs --dry-run
node scripts/install.mjs                    # writes profile/package.json (with a backup)

# restart the DSH web process — bundles are loaded at process start
sudo systemctl restart dsh-web              # or Ctrl+C and re-run `dsh web`
```

Then open the sidebar → **View options** → *Custom groups*.

## Installation

### A. link install (recommended)

`scripts/install.mjs` registers the package in the profile's `package.json` as `link:<repo>`, appends it to
`dsh.profile.bundles`, creates the `node_modules` symlink (junction on Windows) and backs up the file as
`package.json.bak.<UTC timestamp>` first. It is idempotent.

```bash
node scripts/install.mjs --check     # exit 0 = healthy, 1 = needs attention
node scripts/install.mjs --remove    # uninstall
node scripts/install.mjs --json      # machine-readable
```

The repo directory *is* the installed directory: edit `lib/client.js`, refresh the page, done.

### B. manual

```jsonc
// <DSH_HOME>/profiles/web/package.json
{
  "dependencies": { "dsh-session-groups": "link:/absolute/path/to/dsh-session-groups" },
  "dsh": { "profile": { "bundles": [ /* …, */ "dsh-session-groups" ] } }
}
```

```bash
ln -sfn /absolute/path/to/dsh-session-groups <DSH_HOME>/profiles/web/node_modules/dsh-session-groups
```

### C. `dsh plugin add` (not recommended)

It has historically failed with `ERR_PNPM_NO_MATCHING_VERSION` in some profiles and does not guarantee link semantics.

## Usage

| Action | How |
| --- | --- |
| Switch mode | Sidebar → *Custom groups* |
| New group | *New group* at the bottom of the list |
| Assign | Drag onto a group, or row "⋯" → *Move to group…* |
| Detach | Drag back to *Untitled group*, or "⋯" → *Remove from custom group* |
| Rename | Double click / F2 / *Rename group* |
| Reorder | *Move up* / *Move down* |
| Delete | *Delete group* → confirm (sessions return to ungrouped) |
| Collapse | Click the header, or focus it and press Enter / Space |
| Page | *Show N more sessions* inside a group |

### Keyboard

| Key | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | move focus between headers and rows |
| `Enter` / `Space` | collapse / expand the focused group |
| `F2` | rename the focused group |
| `Shift+F10` | open its menu and focus the first item |
| `↑` `↓` `Home` `End` | navigate the menu |
| `Enter` | activate the menu item |
| `Esc` | close menu / cancel rename / cancel delete |

## Data & privacy

State lives in `localStorage` under **`dsh.sessionGroups.v1`**, scoped by origin:

```json
{ "version": 1, "groups": [{ "id": "g1", "name": "Docs" }], "groupOrder": ["g1"], "assignments": { "session-…": "g1" }, "collapsed": {} }
```

No network calls, no telemetry, no session content — only a session-id → group-id map. Uninstalling does **not** delete it;
remove the key or clear site data to wipe it. Export/restore:

```js
copy(localStorage.getItem("dsh.sessionGroups.v1"))
localStorage.setItem("dsh.sessionGroups.v1", "<paste>"); location.reload();
```

## Verification

```bash
node scripts/build.mjs     # rebuild and assert byte-identical output
node scripts/verify.mjs    # 11 checks (falls back to snapshot-only checks when DSH is absent)
node scripts/e2e.mjs --url "http://127.0.0.1:3099/?token=<token>"   # S1–S9 smoke test with a temp Chrome
```

CI runs `build` + `git diff --exit-code -- lib/client.js` + `verify`, and `node --check` on all JS.

## Known issues

See [docs/14-known-issues.md](docs/14-known-issues.md). Highlights:

1. **Tightly bound to the upstream version** — upgrading DSH requires re-vendoring and rebuilding.
2. **Single session browser** — the `sidebar.workspaces` slot is `single`, so this cannot coexist with another session-browser plugin.
3. **localStorage only** — no cross-origin, cross-profile or cross-device sync.
4. **Bundles load at process start** — a restart is required after install/remove.
5. **Row "⋯" menu, not a context menu** — the host renders no real `contextmenu` handler.
6. **Deleting a group is not undoable** (its sessions return to ungrouped).

## Deploying elsewhere

Difficulty and per-environment steps: [docs/13-environments.md](docs/13-environments.md).

| Environment | Difficulty | Key point |
| --- | --- | --- |
| Linux + systemd | ★ | follow this README |
| macOS | ★★ | restart via launchd/foreground instead of systemd |
| Native Windows | ★★★ | junctions instead of symlinks (untested) |
| Container / read-only rootfs | ★★★ | mount `DSH_HOME` as a volume |
| Reverse proxy / multi-user | ★★★★ | one localStorage per origin — users share it |

## Upgrade, removal, rollback

- **Upgrade the plugin**: `git pull` → `build` → `verify` → restart DSH.
- **After upgrading DSH**: `node scripts/vendor.mjs` → rebase patches → `build`/`verify`/`e2e`.
- **Temporarily disable**: comment the bundle entry out → restart.
- **Uninstall**: `node scripts/install.mjs --remove` → restart.
- **Back to the stock sidebar**: uninstall and restart; your groups stay in localStorage.
- Full tiered rollback playbook: [docs/12-release-rollback.md](docs/12-release-rollback.md).

## Repository layout

```
lib/        build output: client.js (injected UI), index.js (server stub)
vendor/     upstream snapshot + upstream.json (sha256 anchor)
patches/    0001…0007 incremental patches applied on top of pristine
scripts/    vendor / build / verify / install / e2e
docs/       design, acceptance, release, environments, known issues
```

### Development workflow

1. edit `lib/client.js` by hand (the artifact is the source);
2. **generate the patch first**: `diff -u --label a/lib/client.js --label b/lib/client.js <previous artifact> lib/client.js > patches/000N-xxx.patch`;
3. then `node scripts/build.mjs` (it overwrites `lib/client.js` from pristine + patches);
4. `node scripts/verify.mjs` must pass and the rebuild must be byte-identical;
5. verify the UI against an isolated instance (separate port + headless Chrome), zero console errors;
6. update docs and commit one stage at a time: `NN-stage: what changed`.

> Doing the build before generating the patch silently discards your edits.

## Maintainer release flow (GitHub token)

Building and running need no credentials; pushing and releasing do.

```bash
gh auth status                     # needs repo scope (workflow for CI changes)
gh auth login                      # device flow
gh repo create Xian-debu/dsh-session-groups --public --source . --push
git tag v1.0.0 && git push --tags
gh release create v1.0.0 --generate-notes
```

- An expired `GITHUB_TOKEN` environment variable overrides `gh`'s stored login and yields 401 — check `gh auth status`, and `unset GITHUB_TOKEN` if needed.
- Not published to npm: installation is profile-link based (an npm package with the same name is unrelated).

## Docs

[docs/01](docs/01-purpose.md) purpose · [02](docs/02-constraints.md) constraints · [03](docs/03-architecture.md) architecture ·
[04](docs/04-extension-points.md) extension points · [05](docs/05-options.md) options · [06](docs/06-design-draft.md) design ·
[07](docs/07-roadmap.md) roadmap · [08](docs/08-conventions.md) conventions · [09](docs/09-risks.md) risks ·
[10](docs/10-finding-duplicate-session-id-menu.md) duplicate menu finding · [11](docs/11-maintenance-log.md) maintenance log ·
[12](docs/12-release-rollback.md) release & rollback · [13](docs/13-environments.md) environments · [14](docs/14-known-issues.md) known issues

## Roadmap

- import/export UI for groups;
- group colors and icons, free ordering inside a group;
- a helper that rebases the patch set onto new upstream releases;
- broader e2e coverage (search / archived / reordering) wired into CI.

## License & credits

MIT — see [LICENSE](LICENSE) and [NOTICE](NOTICE). Portions derived from `@deepseek-ai/dsh-client-ui-workspace` remain
under DeepSeek's original MIT license with attribution. Thanks to the DSH team for an extensible plugin architecture.
