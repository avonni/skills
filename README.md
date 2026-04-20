# Avonni Dynamic Components Skill

A skill that guides an AI agent through creating [Avonni Dynamic Components](https://www.avonni.app/) using the Avonni Dynamic Components MCP server.

## Installation

### Option 1 — npx (recommended)

```bash
npx skills avonni/dynamic-skills
```

This downloads and installs the skill into your current project's configuration automatically.

### Option 2 — Manual installation

1. Clone this repository:

```bash
git clone https://github.com/avonni/dynamic-skills.git
```

2. Copy the skill files into your project's skills directory (e.g. `.claude/skills/`):

```bash
cp -r dynamic-skills/.claude/skills/avonni-dynamic-components /your-project/.claude/skills/
```

## Usage

Once installed, describe the Avonni Dynamic Component you want to build. The AI will use the Avonni MCP server to look up available components, propose a plan, and generate the component metadata file.  

## Requirements

- The Avonni MCP server configured in your AI assistant's settings.
- Any AI agent that is able to execute scripts and generate files (e.g. Claude Code, Cursor, GitHub Copilot, etc.).
