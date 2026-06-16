---
name: avonni-components
description: >
    Integrate Avonni components into the code of an LWC component (HTML, JS, CSS).
    Covers MCP tool usage, attribute/event/type/slot resolution, styling hooks, and validation — not general LWC creation.
    Trigger when: user asks to add, use, or style an Avonni component in their code; when writing or editing LWC that references avonni-* tags; when the user mentions a component name that starts with "avonni-".
license: MIT
compatibility: 'Requires the Avonni MCP server (avonni toolset)'
metadata:
    version: '1.0.0'
---

# avonni-components

Use this skill whenever Avonni components need to be added to or used inside an LWC component. It governs how to discover, configure, and validate Avonni components through the MCP — not how to scaffold the surrounding LWC.

## Toolset

This skill works exclusively with the **`dev` toolset** of the Avonni MCP. All MCP tool calls must include `toolset: "dev"` where applicable. Do not use this skill for Avonni Dynamic Components, Avonni Experience Sites components or for Avonni Flow Screen Components.

If the Avonni MCP tools are not available in the session, stop and ask the user to configure the Avonni MCP server with the `dev` toolset. Never continue without the MCP.

## Authority

-   The MCP is the single source of truth for all Avonni component APIs.
-   Never rely on prior knowledge or assumptions about a component.
-   If MCP data conflicts with prior knowledge, MCP data wins.
-   If required information is missing, do not guess — ask the user.
-   **Never invent components, attributes, events, methods, slots, or object keys.** Only use what the MCP explicitly documents.

## Steps

1. **Understand the request** — Identify what functionality is needed and which Avonni components may be involved.
2. **Call `list_components`** with `toolset: "dev"` — Get the current list of available components. Never skip this.
3. **Select components** — Choose the component(s) that best satisfy the request using the selection criteria below.
4. **Call `get_component_docs`** with `toolset: "dev"` for each selected component — one call per component, never reuse docs across components.
5. **Call `get_type`** for every non-primitive type referenced in attributes, events, or return values.
6. **Resolve nested types recursively** — repeat `get_type` until all types are fully known.
7. **Call `get_component_styles`** with `toolset: "dev"` for each component that needs styling — only if the user request involves CSS or visual customization.
8. **Validate** — run the checklist below before writing any code.
9. **Generate code** — write HTML, JS, and/or CSS using only what the MCP confirmed.

You may not skip or reorder these steps.

## Component Selection

When multiple components could work, prefer the one that:

1. Requires the least custom logic
2. Leverages built-in data features (query/mapping APIs)
3. Produces the least extra code

Reuse existing component instances when possible.

## Attribute Rules

-   Attribute names must match MCP exactly.
-   Use **camelCase** in JS and **kebab-case** in HTML templates.
-   Always include required attributes.
-   Omit attributes whose values equal the documented default.
-   Only use object keys defined in the resolved type schema.
-   For any non-primitive attribute, you must retrieve its type definition before use.

### Complex Types

-   When a component references a complex type (a non-primitive type, e.g. `DdListMapping` or `DdListAvatar`), you must call `get_type` with that exact type name before writing any code that uses it.
-   When multiple nested types are present, recursively call `get_type` for each nested type referenced, until all types used in code are resolved.

## Event Rules

-   Only use events listed in the component's MCP docs.
-   Event handler attributes in HTML must use lowercase (e.g., `onvaluechange`).
-   Access payload only via `event.detail`.
-   Only use properties documented in the event's schema.

## Data-Driven Components

-   Never query Salesforce data yourself.
-   Use the component's built-in `query` and `mapping` APIs.
-   `objectApiName` is required in every query.
-   `filter` must be a valid SOQL WHERE clause **without** the `WHERE` keyword.
-   `orderBy` must be valid SOQL ORDER BY syntax **without** the `ORDER BY` keyword.
-   All referenced fields must exist on the queried object.
-   Template expressions must use the exact syntax `{{Record.FieldApiName}}` (case-sensitive, usable at any nesting level).

## Slot Rules

-   Slots are listed in the `slots` array of a component's documentation.
-   Each slot has a `name` and a `description`.
-   A slot named `"default"` is the **unnamed default slot** in LWC — do not add a `slot` attribute to its children:
    ```html
    <avonni-alert-banner>
        <p>This content goes into the default slot.</p>
    </avonni-alert-banner>
    ```
-   A named slot (any name other than `"default"`) requires a matching `slot` attribute on the child element:
    ```html
    <avonni-some-component>
        <p slot="actions">Action content here.</p>
    </avonni-some-component>
    ```
-   A component can have multiple slots; each is used independently.
-   **Never add a slot if you have no content to put in it.** Omit empty slots entirely from the generated code.
-   Never use a slot name that is not listed in the component's documentation.
-   If a component's documentation has no `slots` array (or it is empty), the component accepts no slotted content — do not add children expecting slot projection.

## Styling Rules

-   To style an Avonni component, you **must** call `get_component_styles` with `toolset: "dev"` for that component first.
-   `get_component_styles` returns all CSS custom properties (styling hooks) the component exposes, along with their default values.
-   Only use CSS variables returned by `get_component_styles` — do not invent variable names.
-   Apply styling hooks in the component's CSS file using standard CSS custom property syntax:

```css
avonni-some-component {
    --avonni-some-component-color-background: #f0f0f0;
}
```

-   Call `get_component_styles` once per component — cache the result and do not call it again for the same component.
-   If `get_component_styles` returns an empty list, the component has no exposed styling hooks; inform the user.

## Utility Functions

The Avonni dev package exposes one utility function: **`removePageHeader`**.

-   Call `get_util_docs` with `name: "removePageHeader"` before using it — do not rely on prior knowledge of its signature.
-   Use it only when the user explicitly needs to hide the Salesforce page header.
-   Call it from a lifecycle hook (e.g. `connectedCallback`) in the LWC JS file.

## Validation Checklist

Before producing final code, confirm all of the following:

-   [ ] Every component exists in the MCP list
-   [ ] Every attribute name exists in the component's docs
-   [ ] Every event name exists in the component's docs
-   [ ] Every method name exists in the component's docs
-   [ ] `get_type` was called for every non-primitive type before use
-   [ ] Every object key exists in the resolved type schema
-   [ ] All required attributes are present
-   [ ] No undocumented APIs are used
-   [ ] Every slot name used exists in the component's `slots` array
-   [ ] No slot is rendered empty
-   [ ] Every CSS variable used in styling was returned by `get_component_styles`

Fix any failure before outputting code.

## Error Handling

| Situation                   | Action                                                    |
| --------------------------- | --------------------------------------------------------- |
| Tool call fails             | Retry once                                                |
| Tool call fails again       | Stop; the skill cannot run without the Avonni MCP server  |
| One component's docs fail   | Continue with successful ones; report which failed        |
| Component not found in list | Inform the user it may not exist or not be documented     |
| Runtime validation fails    | Re-check MCP docs before assuming the component is broken |

## Code Style

-   Follow the workspace LWC conventions for formatting and file structure.
-   Prefer component APIs and built-in features over custom wrapper logic.
-   Use documented examples as structural references, but adapt all values to the actual request.
