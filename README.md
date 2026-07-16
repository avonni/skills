# Avonni Skills

Skills used to guide AI agents through the creation and update of Avonni components.

-   For end-to-end use cases spanning several Avonni artifact types, use the `avonni-architect` skill — it plans the architecture and invokes the other skills in dependency order.
-   For Avonni Dynamic Components, use the `avonni-dynamic-components` skill.
-   For Avonni LWC Components, use the `avonni-lwc-components` skill.
-   For Avonni Flow Screen Components inside Salesforce flows, use the `avonni-flow-components` skill.
-   For Avonni components inside Salesforce Digital Experience sites, use the `avonni-experience-components` skill.

## Installation

### Option 1 — npx (recommended)

```bash
npx skills add avonni/skills
```

This command downloads and installs the skill(s) into your current project's configuration automatically.

### Option 2 — Manual installation

1. Clone or download the `.zip` of this repository.
2. Copy or upload the skill files into your project's skills directory (e.g. `.claude/skills/`):

## Usage

Once installed, describe the Avonni component you want to build. The AI will use the Avonni MCP servers to look up available components, propose a plan, and generate the components.

## Requirements

-   The Avonni MCP server configured in your AI assistant's settings.
-   Any AI agent that is able to execute scripts and generate files (e.g. Claude Code, Cursor, GitHub Copilot, etc.).
-   [NodeJS](https://nodejs.org/en/download) installed.
-   The [Salesforce CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm) installed.
