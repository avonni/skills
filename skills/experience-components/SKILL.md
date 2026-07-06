---
name: experience-components
description: Add, update, or remove Avonni components inside an existing Salesforce Digital Experience site. Use when the user wants to place Avonni components on a site page, when editing a site view's content.json that contains avxp: or avcmpbuilder: components, or when wiring those components to records, navigation, or styling. Does not cover creating the site, routes, themes, branding, or layouts — only the integration of Avonni components into an existing site. Do NOT use when the request spans multiple Avonni artifact types (e.g. the site page plus a flow it opens) — use the avonni-architect skill instead.
license: MIT
compatibility: Requires Node.js >=18, the Avonni MCP server (experience toolset), and Salesforce CLI.
metadata:
    version: '1.0.0'
---

# avonni-experience-components

## Toolset

This skill works exclusively with the **`experience` toolset** of the Avonni MCP. All MCP tool calls must include `toolset: "experience"` where applicable. Do not use this skill for standard Avonni LWC components, Avonni Dynamic Components, or Avonni Flow Screen Components.

## Package Namespace

Avonni Experience components are delivered by a managed package whose namespace is either **`avxp`** or **`avcmpbuilder`**, depending on which package the user's org has installed. The namespace is the prefix of every Avonni component `definition` in a view's `content.json` (e.g. `avxp:xpcButton` or `avcmpbuilder:xpcButton`).

Detect it once per task in Step 1 by running:

```
node <skill_base_directory>/scripts/namespace.mjs <path-to-content.json>
```

The script checks, in order: the `AVONNI_XP_PACKAGE_NAMESPACE` env var, the namespaces already used by Avonni nodes in the view, and the packages installed in the org (via the Salesforce CLI), falling back to `avxp`. If it exits with an ambiguity error (both packages installed, no other signal), ask the user which package their site uses before continuing. If it warns that no Avonni Experience package was detected in the org, relay that warning to the user — the components you generate will not render on the site until a package is installed — then continue normally.

Wherever this skill or its references write `<namespace>:` (or show `avxp:` in an example), use the detected namespace. Never hardcode a namespace, and never mix both namespaces in the same view.

## Scope

This skill governs **only** the integration of Avonni components into an **existing** Digital Experience site — the Avonni (`avxp:` or `avcmpbuilder:`) component nodes inside a view's `content.json` (under `force-app/main/default/digitalExperiences/site/<site>/sfdc_cms__view/<view>/content.json`). It covers how to discover, configure, validate, and write those component nodes.

It does **not** cover creating or configuring the site itself: sites, routes (`sfdc_cms__route`), themes (`sfdc_cms__theme`), branding sets, theme layouts, or pages must already exist and are handled by general Digital Experience tooling. When updating an existing view, never restructure, reformat, or rewrite anything outside the Avonni component nodes you were asked to change — leave layout sections, hidden regions, and non-Avonni components (e.g. `dxp_base:textBlock`, `community_*`) untouched unless the request is specifically about moving an Avonni component between them.

If the request also requires building a flow or Dynamic Component the site components will call, stop and tell the user to restart with the avonni-architect skill. If no skill named avonni-architect is available, redirect to any skill whose purpose is orchestrating multi-artifact Avonni solutions; if none exists, suggest installing it with `npx skills avonni/skills`.

## Prerequisites

Check these before Step 1. They enforce the requirements listed in this skill's `compatibility` frontmatter. If a check was already performed earlier in this session (e.g. by the avonni-architect skill before dispatching), do not repeat it — reuse its result:

1. **Node.js >= 18** — run `node --version`. If the command fails or the major version is below 18, stop and ask the user to install Node.js 18 or newer. Do not proceed.
2. **Avonni MCP server** — the first MCP call of the workflow (whichever tool it is, always with `toolset: "experience"`) doubles as the reachability check. If the Avonni MCP tools are not available in the session, or the call fails after one retry, stop and ask the user to configure the Avonni MCP server with the `experience` toolset. Never continue without the MCP.
3. **Salesforce CLI** — run `sf --version`. If it fails, do NOT stop: warn the user once that the Salesforce CLI is not installed and that retrieving object and field documentation will be unavailable, then continue. The steps that need it stop with install instructions if reached.

## Execution Workflow

To produce your output, you MUST follow the steps below in order — you cannot skip a step. If you go back to a previous step, all subsequent steps have to be executed again in order.

### Step 1 — Read the View

Read `references/read-site-view.md` and follow its instructions to:

-   Locate `content.json` for the target view. If you cannot find it, ask the user which site and view (page) they mean and locate `…/sfdc_cms__view/<view>/content.json`. Never create the site, route, theme, or view using this skill — if the target view does not exist, stop and tell the user to create the page first with their usual Digital Experience tooling.
-   Detect the package namespace: run `node <skill_base_directory>/scripts/namespace.mjs <path-to-content.json>` (see **Package Namespace**) and use its result as `<namespace>` for the rest of the task.
-   Walk the component tree and identify the existing layout regions and all current Avonni components.
-   If the user has not yet described what they want to add, change, or remove, present the existing Avonni components in reading order (top to bottom, by slot), using their labels and a short summary of what each is configured to do, then ask what they want to change. Otherwise, proceed directly to Step 2.

### Step 2 — Plan

Read `references/plan-site-components.md`. Then make a component plan strictly following the instructions in that file, incorporating the user's request against the current view state. Structure the plan as: components added, components changed, components removed (omit empty sections).

### Step 3 — Validate the Plan

Ask the user to validate your plan.

-   If the plan is accepted as is, continue to step 4.
-   If the user asks for changes, go back to step 2.

### Step 4 — Build

Read `references/build-view-content.md`. Apply the planned changes strictly following the instructions in that file.

-   Insert new component nodes into the chosen region's `children` array at the position the plan specifies (default: end of the array).
-   Edit only the `attributes` (or slot `children`) of targeted existing `<namespace>:` nodes — keep their `id`.
-   Remove targeted `<namespace>:` component nodes from their parent region's `children`. If removal empties a region you added, remove that region too; never remove pre-existing layout regions.
-   Leave every other part of the view untouched, including formatting and node order.

### Step 5 — Validate

Run `node <skill_base_directory>/scripts/validate-view.mjs <path-to-content.json>`.

-   If validation reports errors in the nodes you touched, fix them and run it again. Loop until no error from those nodes remains.
-   Do not fix errors in parts of the view you did not touch — report them to the user instead.

### Step 6 — Summarize

-   Tell the user which view file was updated and where components were placed or changed.
-   Tell them the site was not deployed or published.
-   Summarize what changed compared to the previous version (added / changed / removed).

## Authority

-   The MCP is the single source of truth for Avonni Experience component APIs.
-   Never rely on prior knowledge or assumptions about components.
-   If MCP data conflicts with prior knowledge, MCP data is always correct.
-   If required information is missing, do not guess — request it.
-   **Never invent components, properties, options, interactions, or styling hooks.** Only use what the MCP explicitly documents, plus the content.json serialization rules defined in this skill's references.

## Global Tool Usage Rules

-   Never request the same docs twice — cache results.
-   Never rely on one component's docs to assume another's.
-   Always use the tool result directly as returned by the MCP, even if the output is large. Never use Bash commands, file reads, or any other tool to shorten, parse, or reprocess the MCP result.

### Global Output Rules

When referring to components or interactions, use a natural-language label derived from their name: remove the `xpc` prefix (for components) and insert spaces between words.
**Examples:**
xpcList → List
xpcAccordionSection → Accordion Section
NavigationMixinNavigate → Navigate

When referring to properties or styling hooks, convert their names into natural language labels.
**Examples:**
iconName → icon name
showNbItems → show number of items
--avdxp-button-color-background → button background color

## Unknown or Ambiguous Requests

If you need more information from the user:

-   Stop generation.
-   Respond in plain text (not JSON) explaining what is unknown or ambiguous.
-   Ask the user to clarify or provide the correct component, property, site, or view.

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

-   inform the user it may not exist or be documented for the `experience` toolset

If validation fails:

-   re-check MCP docs before assuming a component is broken
