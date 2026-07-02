# Interactions

Some component properties are typed `interaction[]` in the MCP docs. They hold an **interaction configuration**: what happens when the user interacts with the component.

## Discover Interactions

1. Call `list_interactions` with `toolset: "experience"` to see the available interaction types.
2. Call `get_interaction_docs` with `toolset: "experience"` and the interaction name to get its properties. Never invent interaction types or properties.

## Shape

An interaction is an object: a `type` discriminator plus the properties documented for that type.

**Example:**

```json
{
    "type": "NavigationMixinNavigate",
    "navigationMixinNavigateType": "standard__recordPage",
    "navigationMixinNavigateRecordPageRecordId": "{{Record.Id}}",
    "navigationMixinNavigateRecordPageActionName": "view"
}
```

## Property Position in the Value and Formatting

-   Top-level attribute: the interaction object is serialized like any other complex attribute — a **compact JSON string** as the attribute value.
-   Nested inside another serialized blob: it is a **plain nested object**, not a re-encoded string.
