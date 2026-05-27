---
name: dynamic-components
description: Create or update Avonni Dynamic Components. Use when the user asks to build, generate, or modify a dynamic component, or when working with Dynamic Component JSON, queries, resources, or metadata files.
license: MIT
compatibility: Requires Node.js >=18, the Avonni MCP server (dynamic toolset), and Salesforce CLI.
metadata:
    version: '1.0.0'
---

# avonni-dynamic-components

## Toolset

This skill works exclusively with the **`dynamic` toolset** of the Avonni MCP. All MCP tool calls must include `toolset: "dynamic"` where applicable. Do not use this skill for standard Avonni LWC components (use the `avonni-components` skill instead).

## Usage

This skill describes how to use the Avonni Dynamic Components MCP to create or update components. You should use it for any user request that aims to create or update an Avonni Dynamic Component.

## Execution Workflow

To create your output, you MUST follow the steps below. The steps should always be executed in order, you cannot skip a step. If you go back to a previous step, all subsequent steps have to be executed again in order.

### Step 0 — Detect Intent

Determine whether the user wants to **create** a new component or **update** an existing one from a metadata file. If the request is ambiguous, ask the user to clarify before proceeding.

-   If **creating**: follow the **Create Path** below.
-   If **updating**: follow the **Update Path** below.

---

### Create Path

1. Read `references/plan-component.md`. Then make a component building plan strictly following the instructions in that file.
2. Ask the user to validate your plan.
    - If the plan is accepted as is, continue to step 3.
    - If the user asks for changes, go back to step 1.
3. Read `references/build-component.md`. Then generate the planned components JSON strictly following the instructions in that file.
    - Keep the JSON in memory — do not write it to disk. It is piped to the save script in the next step.
4. Read `references/create-component-metadata.md` and follow its instructions to create a custom metadata record file.
5. Summarize the task result to the user:
    - Tell them that the component file has been created and where.
    - Tell them that the component was not deployed.
    - Summarize the component features.

---

### Update Path

1. Read `references/read-component-metadata.md` and follow its instructions to parse the existing metadata file and present the current component to the user.
2. Ask the user to describe the changes they want to make.
3. Read `references/plan-component.md`. Then make an updated component building plan strictly following the instructions in that file, incorporating the requested changes.
4. Ask the user to validate your updated plan.
    - If the plan is accepted as is, continue to step 5.
    - If the user asks for changes, go back to step 3.
5. Read `references/build-component.md`. Then generate the updated components JSON strictly following the instructions in that file.
    - Keep the JSON in memory — do not write it to disk. It is piped to the save script in the next step.
6. Read `references/create-component-metadata.md` and follow its instructions to save the updated component version.
7. Summarize the task result to the user:
    - Tell them what file has been created or updated, and where.
    - Tell them that the component was not deployed.
    - Summarize what changed compared to the previous version.

## Authority

-   The MCP is the single source of truth for Avonni Dynamic Components APIs.
-   Never rely on prior knowledge or assumptions about components.
-   If MCP data conflicts with prior knowledge, MCP data is always correct.
-   If required information is missing, do not guess — request it.

## Global Tool Usage Rules

-   Never request the same docs twice — cache results.
-   Never rely on other components to assume the docs of a component.
-   Always use the tools result directly as returned by the MCP, even if the output is large. Never use Bash commands, file reads, or any other tool to shorten, parse, or reprocess the MCP result.

### Global Output Rules

When referring to components or interactions, use their label, not their name.
**Examples:**
dcLayout → Columns Container
dcCard → Card
CreateRecordFromRecordVariable → Create Record

When referring to properties or styling hooks, convert their names into natural language labels.
**Examples:**
iconName → icon name
hideTableHeader → hide table header
--avonni-button-icon-image-radius-border → image radius border
border-color → border color
--avcmpbuilder-primitive-global-header-caption-text-color → header caption text color

## Unknown or Ambiguous Requests

If you need more information from the user:

-   Stop generation.
-   Respond in plain text (not JSON) explaining what is unknown or ambiguous.
-   Ask the user to clarify or provide the correct component or property name.

## Failure Handling

If a tool call fails:

-   retry once

If it still fails:

-   inform the user
-   ask whether to continue without MCP

If one component doc fails:

-   continue using successful ones
-   report which failed

If a component is missing:

-   inform user it may not exist or be documented

If runtime validation fails:

-   re-check MCP docs before assuming component is broken
