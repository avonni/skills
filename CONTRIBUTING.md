# Contributing

This repository is maintained by the Avonni team. We don't accept external pull requests.

## Report a bug or suggest an improvement

Send an email to [support@avonni.app](mailto:support@avonni.app). To help us reproduce the issue, include:

-   The skill name and version (`metadata.version` at the top of the skill's `SKILL.md`), or the plugin version if you installed the Avonni plugin.
-   How you installed the skills: `npx skills`, the Claude Code or Codex plugin, or a manual copy.
-   The AI agent and model you used (for example, Claude Code with Claude Opus).
-   What you asked the agent to do.
-   What happened, and what you expected instead.
-   Any error messages or generated files that show the problem.

Don't include passwords, access tokens or customer data.

## Versioning

Versions follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`. There are two levels.

### Skill version

Each skill has its own version in `metadata.version` of `skills/<skill>/SKILL.md`. Bump it based on what an agent or user of the previous version would notice:

| Bump      | When                                                                                                                                                                                                                         | Examples                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Major** | The change breaks existing setups or work: the skill is renamed or removed, a supported capability is dropped, a new prerequisite is required, or the output is no longer compatible with what the previous version created. | Rename a skill. Require a new MCP toolset. Change the saved metadata format so older components can't be updated.          |
| **Minor** | The skill can do something new, and existing setups keep working.                                                                                                                                                            | Support a new component, data source or mode. Add a script or reference that adds a capability. Use a new optional tool.   |
| **Patch** | The skill does what it already claimed to do, but better: fixes and corrections that add no capability.                                                                                                                      | Fix wrong instructions or a validation script. Add a guardrail. Fix the frontmatter. Reword a step to change its behavior. |

Rules:

-   Any change to a file under `skills/<skill>/` bumps that skill by at least a patch. Scripts and references ship with the skill, so they count, not only `SKILL.md`.
-   Bump each skill once per pull request, compared to `main`. If a pull request has both a fix and a new feature, bump the minor version only.
-   A new skill starts at `1.0.0`.
-   Changes outside `skills/` (tests, CI, README, repository tooling) don't bump any skill.

### Plugin version

The plugin version is shared by all skills. It's set in three files that must always match:

-   `package.json`
-   `.claude-plugin/plugin.json`
-   `.codex-plugin/plugin.json`

`npm test` fails if they don't match.

Bump the plugin version in the same pull request as the skill bumps, using the highest level among them. For example, if one skill gets a patch and another gets a minor, bump the plugin's minor version.

Changes to the plugin itself also bump it:

-   **Major:** remove or rename a skill, or make a breaking change to `.mcp.json`.
-   **Minor:** add a skill or an MCP server.
-   **Patch:** fix the plugin manifests' metadata (description, keywords, links).

If no skill version changes and nothing in `.claude-plugin/`, `.codex-plugin/` or `.mcp.json` changes, don't bump the plugin. Changes to `package.json` fields other than `version` don't count.

If another pull request bumps the version before yours merges, rebase on `main` and bump again from the new version.

### Changelog

Every plugin bump adds an entry at the top of [`CHANGELOG.md`](CHANGELOG.md). Use the merge date, list each skill that changed with its new version, and group its changes under `Added`, `Changed`, `Fixed` or `Removed`:

```md
## 1.1.0 - 2026-10-20

### avonni-dynamic-components 1.1.0

#### Added

-   Support for chart components (ENG-1234).

### avonni-flow-components 1.0.1

#### Fixed

-   Keep screen field order when updating a flow (ENG-1235).
```

## Pull requests

-   Title format: `[type] (ENG-1234): Message`, with types such as `feat`, `fix`, `refactor`, `docs`, `test` and `version`. Pull requests are squash-merged with the same title.
-   Fill in the checklist from the pull request template. A version bump can be its own commit, for example `[version] (ENG-1234): Bump skill version number to next patch`.
-   Run `npm test` before opening the pull request.
