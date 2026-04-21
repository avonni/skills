---
name: avonni-dynamic-components
description: Create Avonni Dynamic Components.
---

# avonni-dynamic-components

## Usage

This skill describes how to use the Avonni Dynamic Component MCP to create components. You should use it for any user request that aims to create an Avonni Dynamic Component.

## Execution Workflow

To create your output, you MUST follow the steps below. The steps should always be executed in order, you cannot skip a step. If you go back to a previous step, all subsequent steps have to be executed again in order.

1. Call `list_components` using the MCP.
2. Determine what components fit the user request.
    - If the user request is unclear on what component to use, ask questions.
    - Do not ask questions on features at this stage.
    - Only consider components that are listed in the component list you retrieved in step 1. Never make up components.
    - Be decisive. If you hesitate between two components, pick one.
    - Before selecting components:
        1. Identify the user interface type (dashboard, form, record page, gallery, etc.).
        2. Determine the main functional blocks required.
        3. Select the components that best implement those blocks.
3. Call `get_component_docs` once per selected component.
    - Pass the component name as a single `name` string input.
    - Never batch multiple components into one call.
    - Process each response directly — no shell commands are needed to parse the result.
4. Read `references/plan-component.md`. Then make a component building plan strictly following the instructions in that file.
5. Ask the user to validate your plan.
    - If the plan is accepted as is, continue to the step 7.
    - If the user asks for a new component, go back to step 1.
    - If the user asks for different component features, go back to step 4.
6. Read `references/build-component.md`. Then generate the planned components JSON strictly following the instructions in that file.
    - Write the JSON output to a temporary `component.json` file.
7. Read `references/create-component-metadata.md` and follow its instructions to create a custom metadata record file.
8. Delete the temporary `component.json` file.
9. Summarize the task result to the user:
    - Tell them that the component file has been created and where.
    - Tell them that the component was not deployed.
    - Summarize the component features.

## Authority

-   The MCP is the single source of truth for Avonni Dynamic Components APIs.
-   Never rely on prior knowledge or assumptions about components.
-   If MCP data conflicts with prior knowledge, MCP data is always correct.
-   If required information is missing, do not guess — request it.

## Tool Usage Rules

-   You can never call `get_component_docs` before calling `list_components`.
-   Never assume the name of a component, always check the `list_components` output.
-   Only retrieve docs for components you actually plan to use.
-   Never request the same docs twice — cache results.
-   Never rely on other components to assume the docs of a component.
-   Always use the tools result directly as returned by the MCP, even if the output is large. Never use Bash commands, file reads, or any other tool to shorten, parse, or reprocess the MCP result.

### Mandatory output rules

When referring to components, use their label, not their name.
**Examples:**
dcLayout → Columns Container
dcCard → Card
dcDatatable → Data Table

When referring to properties, convert their names into natural language labels.
**Examples:**
iconName → icon name
hideTableHeader → hide table header
rowNumberOffset → row number offset

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
