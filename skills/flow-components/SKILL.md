---
name: flow-components
description: Add, update, or remove Avonni Flow Screen Components inside a Salesforce flow. Use when the user wants Avonni components in a screen flow, when editing flow XML that contains avcmpbuilder extensions, or when creating a new screen flow built around Avonni components. Does not cover general flow logic (decisions, assignments, record operations).
license: MIT
compatibility: Requires Node.js >=18, the Avonni MCP server (flow toolset), and Salesforce CLI.
metadata:
    version: '1.0.0'
---

# avonni-flow-components

## Toolset

This skill works exclusively with the **`flow` toolset** of the Avonni MCP. All MCP tool calls must include `toolset: "flow"` where applicable. Do not use this skill for standard Avonni LWC components (use the `avonni-components` skill instead) or for Avonni Dynamic Components (use the `dynamic-components` skill instead).

## Scope

This skill governs **only** the Avonni screen component fields inside a flow — `<fields>` elements whose `extensionName` starts with `avcmpbuilder:`. It covers how to discover, configure, validate, and write those fields into a `.flow-meta.xml` file.

It does **not** cover general flow logic. When a request also requires decisions, assignments, loops, record operations, or other flow elements, build the Avonni screen fields with this skill and handle the rest of the flow outside of it. When updating an existing flow, never restructure, reformat, or rewrite anything outside the Avonni component fields you were asked to change.

## Prerequisites

Check these before Step 0. They enforce the requirements listed in this skill's `compatibility` frontmatter:

1. **Node.js >= 18** — run `node --version`. If the command fails or the major version is below 18, stop and ask the user to install Node.js 18 or newer. Do not proceed.
2. **Avonni MCP server** — the first MCP call of the workflow (`list_components` with `toolset: "flow"`) doubles as the reachability check. If the Avonni MCP tools are not available in the session, or the call fails after one retry, stop and ask the user to configure the Avonni MCP server with the `flow` toolset. Never continue without the MCP.
3. **Salesforce CLI** — run `sf --version`. If it fails, do NOT stop: warn the user once that the Salesforce CLI is not installed and that retrieving object and field documentation will be unavailable, then continue. The steps that need it stop with install instructions if reached (see `references/get-object-documentation.md`).

## Execution Workflow

To create your output, you MUST follow the steps below. The steps should always be executed in order, you cannot skip a step. If you go back to a previous step, all subsequent steps have to be executed again in order.

### Step 0 — Detect Intent

Determine whether the user wants to:

-   **Create** a new flow containing Avonni components → follow the **Create Path**.
-   **Update** an existing flow (add, modify, or remove Avonni components — including adding the first Avonni component to a flow that has none) → follow the **Update Path**. Require the path to the `.flow-meta.xml` file; if you cannot find it, ask the user.

If the request is ambiguous, ask the user to clarify before proceeding.

---

### Create Path

1. Read `references/plan-screen-components.md`. Then make a component building plan strictly following the instructions in that file.
2. Ask the user to validate your plan.
    - If the plan is accepted as is, continue to step 3.
    - If the user asks for changes, go back to step 1.
3. Create the flow shell:
    - If the session has another skill or tool whose purpose is creating Salesforce flows (not this skill), use it to create a **Screen Flow** containing at least one screen, and obtain the path of the resulting `.flow-meta.xml` file in the project. If it created the flow in the org without producing a local file, retrieve it locally (e.g. `sf project retrieve start --metadata Flow:<ApiName>`) before continuing.
    - Otherwise — or if the delegated creation fails, or you cannot obtain a local screen-flow file — run `node <skill_base_directory>/scripts/create-flow.mjs` to scaffold the flow file (see `--help` for usage). Never write the flow scaffold by hand.
4. Read `references/build-screen-field.md`. Then generate the planned component fields strictly following the instructions in that file, and insert them into the target screen.
5. Run `node <skill_base_directory>/scripts/fix-flow.mjs <path-to-flow-file>` to generate the auto-filled values (such as `systemContext`), then `node <skill_base_directory>/scripts/validate-flow.mjs <path-to-flow-file>`.
    - If validation reports errors, fix them and run both scripts again. Loop until validation passes.
6. Summarize the task result to the user:
    - Tell them the flow file has been created and where.
    - Tell them the flow was not deployed.
    - Summarize the components and their features.

---

### Update Path

1. Read `references/read-flow.md` and follow its instructions to parse the existing flow and present the current Avonni components to the user.
2. Ask the user to describe the changes they want to make, unless they already did.
3. Read `references/plan-screen-components.md`. Then make a component building plan strictly following the instructions in that file, incorporating the requested changes.
4. Ask the user to validate your plan.
    - If the plan is accepted as is, continue to step 5.
    - If the user asks for changes, go back to step 3.
5. Read `references/build-screen-field.md`. Then apply the planned changes strictly following the instructions in that file.
    - Edit only the `<fields>` blocks targeted by the plan; insert new ones at the position defined in `references/build-screen-field.md`. Leave every other part of the flow untouched, including formatting and element order.
6. Run `node <skill_base_directory>/scripts/fix-flow.mjs <path-to-flow-file>` to generate the auto-filled values (such as `systemContext`), then `node <skill_base_directory>/scripts/validate-flow.mjs <path-to-flow-file>`.
    - If validation reports errors in the fields you touched, fix them and run both scripts again. Loop until no error from those fields remains.
    - Do not fix errors in parts of the flow you did not touch — report them to the user instead. Such errors can legitimately remain after the loop.
7. Summarize the task result to the user:
    - Tell them what file has been updated.
    - Tell them the flow was not deployed.
    - Summarize what changed compared to the previous version.

## Authority

-   The MCP is the single source of truth for Avonni Flow Screen Components APIs.
-   Never rely on prior knowledge or assumptions about components.
-   If MCP data conflicts with prior knowledge, MCP data is always correct.
-   If required information is missing, do not guess — request it.
-   **Never invent components, properties, interactions, data source modes, or styling hooks.** Only use what the MCP explicitly documents, plus the flow serialization parameters defined in this skill's references.

## Global Tool Usage Rules

-   Never request the same docs twice — cache results.
-   Never rely on other components to assume the docs of a component.
-   Always use the tools result directly as returned by the MCP, even if the output is large. Never use Bash commands, file reads, or any other tool to shorten, parse, or reprocess the MCP result.

### Global Output Rules

When referring to components or interactions, use their label, not their name.
**Examples:**
datatable → Data Table
avatarGroup → Avatar Group
NavigationMixinNavigate → Navigate

When referring to properties or styling hooks, convert their names into natural language labels.
**Examples:**
iconName → icon name
itemsTypeSelected → data source type
--avonni-alert-base-color-background → base background color

## Unknown or Ambiguous Requests

If you need more information from the user:

-   Stop generation.
-   Respond in plain text (not XML) explaining what is unknown or ambiguous.
-   Ask the user to clarify or provide the correct component or property name.

## Failure Handling

If an MCP tool call fails:

-   retry once

If it still fails:

-   inform the user that this skill cannot run without the Avonni MCP server and stop
-   never generate output without MCP data

If one component doc fails:

-   continue using successful ones
-   report which failed

If a component is missing:

-   inform user it may not exist or be documented

If creating the flow shell through another skill or tool fails:

-   fall back to `scripts/create-flow.mjs` and continue
-   mention the fallback in the final summary

If runtime validation fails:

-   re-check MCP docs before assuming component is broken
