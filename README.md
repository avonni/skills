# Avonni Dynamic Components Skill

A skill that guides an AI agent through creating [Avonni Dynamic Components](https://www.avonni.app/) using the Avonni Dynamic Components MCP server.

## Installation

### Option 1 — npx (recommended)

```bash
npx skills avonni/skills
```

This downloads and installs the skill into your current project's configuration automatically.

### Option 2 — Manual installation

1. Clone or download the `.zip` of this repository.
2. Copy or upload the skill files into your project's skills directory (e.g. `.claude/skills/`):

## Usage

Once installed, describe the Avonni Component you want to build. The AI will use the Avonni MCP server to look up available components, propose a plan, and generate the component metadata file.

## Requirements

-   The Avonni MCP server configured in your AI assistant's settings.
-   Any AI agent that is able to execute scripts and generate files (e.g. Claude Code, Cursor, GitHub Copilot, etc.).
-   [NodeJS](https://nodejs.org/en/download) installed.
-   The [Salesforce CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm) installed.
