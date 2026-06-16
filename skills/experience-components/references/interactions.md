# Interactions

Some component properties are typed `interaction[]` in the MCP docs — for example a Button's `evtClick`, or a List item mapping's `evtclick`. They hold an **interaction configuration**: what happens when the element is clicked (navigate to a record, open a URL, etc.).

## Discover Interactions

1. Call `list_interactions` with `toolset: "experience"` to see the available interaction types.
2. Call `get_interaction_docs` with `toolset: "experience"` and the interaction name (e.g. `NavigationMixinNavigate`) to get its properties. Never invent interaction types or properties.

## Shape

An interaction is an object: a `type` discriminator plus the properties documented for that type. For `NavigationMixinNavigate`, set `navigationMixinNavigateType` first, then the properties for that page kind:

```json
{
    "type": "NavigationMixinNavigate",
    "navigationMixinNavigateType": "standard__recordPage",
    "navigationMixinNavigateRecordPageRecordId": "{{Record.Id}}",
    "navigationMixinNavigateRecordPageActionName": "view"
}
```

Only include the properties whose `when` condition matches the chosen `navigationMixinNavigateType` (the docs mark each property with the type it applies to).

## Where It Goes

-   **Top-level attribute** (e.g. a Button's `evtClick`): the interaction object is serialized like any other complex attribute — a **compact JSON string** as the attribute value:

    ```json
    "evtClick": "{\"type\":\"NavigationMixinNavigate\",\"navigationMixinNavigateType\":\"standard__webPage\",\"navigationMixinNavigateWebPageUrl\":\"https://example.com\"}"
    ```

-   **Nested inside another serialized blob** (e.g. a List item mapping's `evtclick` inside `items`): it is a **plain nested object**, not a re-encoded string — the whole `items` value is the single JSON string (see `references/data-sources.md`).

## Record Templates

Inside a data-bound context (a List item mapping), reference the current record's fields with `{{Record.FieldApiName}}` templates — e.g. `"navigationMixinNavigateRecordPageRecordId": "{{Record.Id}}"`. Use real field API names; retrieve them via `references/get-object-documentation.md` when unsure.
