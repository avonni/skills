# Building Component Nodes in a View

This reference defines exactly how to write Avonni component nodes into a view's `content.json`. Build only the `<namespace>:` nodes (and the region nodes that hold them); never touch the rest of the file.

`<namespace>` is the package namespace detected in Step 1 (`avxp` or `avcmpbuilder`, via `scripts/namespace.mjs`). The examples below use `avxp:`; substitute the detected namespace verbatim. Never mix both namespaces in one view.

## Node Grammar

The tree alternates **component** and **region** nodes.

### Component node

```json
{
    "definition": "<namespace>:<componentName>",
    "id": "<UUID>",
    "type": "component",
    "attributes": { ... },
    "children": [ <region nodes> ]
}
```

-   `definition` — always the detected `<namespace>:` + the exact component name from `list_components` (e.g. `avxp:xpcButton`, `avcmpbuilder:xpcList`). Never invent the name; use the MCP name verbatim.
-   `id` — a fresh UUID, unique within the whole file. Generate one per node with `node <skill_base_directory>/scripts/new-uuids.mjs <count>`. Never reuse an existing id.
-   `type` — always the literal `"component"`.
-   `attributes` — the configured properties (see **Attributes**). Omit the key when there are none.
-   `children` — present **only** for components that have slots. Each child is a **region** node, one per slot you fill.

### Region node

```json
{
    "id": "<UUID>",
    "name": "<slotName>",
    "title": "<slotName>",
    "type": "region",
    "children": [ <component nodes> ]
}
```

-   `name` — must equal one of the parent component's documented slot names (`get_component_docs` → `slots[].name`, e.g. `title`, `actions`, `content`). Never invent a slot name.
-   `title` — same value as `name` is fine.
-   `type` — always the literal `"region"`.
-   `children` — the component nodes placed in that slot. A region with no content can omit `children` (an empty slot still appears as a region node in the builder, but you only need to write regions you fill).

## Attributes

Each property from the component's docs becomes a key in `attributes`. **How a value is serialized depends on its type:**

-   **Scalars** (`string`, `boolean`, `number`, `icon`, `url`) → the plain JSON value:

    ```json
    "label": "Learn more",
    "disabled": false,
    "iconName": "utility:add",
    "variant": "brand"
    ```

-   **Objects, arrays, and interactions** (`object`, `record`, `interaction`, and the serialized `*Attributes` blobs) → a **compact JSON string** (the object encoded with `JSON.stringify`, no surrounding whitespace), stored as the attribute's string value. For example a List's data source:

    ```json
    "items": "{\"type\":\"query\",\"querySObjectApiName\":\"Account\",\"querySObjectMapping\":{\"label\":\"{{Record.Name}}\",\"name\":\"{{Record.Id}}\",\"evtclick\":{\"type\":\"NavigationMixinNavigate\",\"navigationMixinNavigateType\":\"standard__recordPage\",\"navigationMixinNavigateRecordPageRecordId\":\"{{Record.Id}}\",\"navigationMixinNavigateRecordPageActionName\":\"view\"}}}"
    ```

    See `references/data-sources.md` for `items` and `references/interactions.md` for `evtClick`/`evtclick`. For `*Attributes` blobs the MCP marks as serialized JSON, only set them when the user asks and you know the shape — otherwise leave them out.

Only write attributes that exist in the component's `get_component_docs` output. Omit any attribute the user did not ask to configure; the builder applies its own defaults.

## Slots and Containers

When a component has slots, build a region node per filled slot and nest the child components inside:

```json
{
    "definition": "avxp:xpcAccordionSection",
    "id": "<UUID-1>",
    "type": "component",
    "attributes": { "label": "Overview" },
    "children": [
        {
            "id": "<UUID-2>",
            "name": "content",
            "title": "content",
            "type": "region",
            "children": [
                {
                    "definition": "avxp:xpcButton",
                    "id": "<UUID-3>",
                    "type": "component",
                    "attributes": { "label": "Open", "variant": "brand" }
                }
            ]
        }
    ]
}
```

An Accordion (`<namespace>:xpcAccordion`) holds Accordion Sections in its `content` region; each Section exposes `title`, `actions`, and `content` slots. Verify slot names with `get_component_docs`.

## Placing a Component on the Page

To add a top-level component, append its node to the `children` of an existing **layout column region** (a `community_layout:section`'s column, e.g. the region named `col1`) inside the page's main content region. Reuse the page's existing sections/columns — do not create new layout sections unless the user explicitly asks.

A `community_layout:section`'s column is declared both as a region node and inside the section's `sectionConfig` attribute (a JSON string listing columns by `columnKey`/UUID). If you reuse an existing column you do not touch `sectionConfig`. Only if you add a brand-new column would you also add it to `sectionConfig` — avoid this unless required.

## UUID Rules

-   Every `id` in the file must be unique.
-   Generate fresh UUIDs for every new node with `node <skill_base_directory>/scripts/new-uuids.mjs <count>`.
-   Never copy an id from another node or from these examples.

## Editing Rules

-   **Add:** insert new component nodes into the chosen region's `children` array, at the position the plan specifies (default: end of the array).
-   **Update:** change only the `attributes` (or slot `children`) of the targeted `<namespace>:` node, found by its `id` or definition+position. Keep its `id`.
-   **Remove:** delete the targeted `<namespace>:` component node from its parent region's `children`. If removing it empties a region you added, remove that region too; never remove pre-existing layout regions.
-   Preserve the file's existing formatting and the order of everything you did not change.

After writing, run `node <skill_base_directory>/scripts/validate-view.mjs <path-to-content.json>` and fix any errors in the nodes you touched.
