# Interactions

Interactions define what happens in response to a user event on a component — for example, navigating to a record when an item is clicked, or showing a toast when an action button is pressed. They are configured on component properties of type `interaction[]`, which correspond to specific events exposed by the component.

## Execution Workflow

Before writing any interaction JSON:

1. Call `list_interactions` to get the list of available interactions.
    - If you already called this tool, use the cached result. Do not call `list_interactions` twice.
2. For each interaction you plan to use, call `get_interaction_docs` once with the interaction name.
    - Never batch multiple interactions into one call.
    - Never assume the properties of an interaction — always retrieve its docs.
    - If you already called this tool, use the cached result. Do not call `get_interaction_docs` for the same interaction twice.
3. Identify the properties that match the required behavior.
4. Write the interaction JSON using the format below.

## Error Handling

If `list_interactions` or `get_interaction_docs` fails:

-   Retry once.
-   If it still fails, inform the user and ask whether to continue without that interaction.

## JSON Format

An interaction property in a component's `value` is an array of interaction objects:

```json
"evtComponentPropertyName": [
    {
        "type": "InteractionName",
        "interactionPropertyName": "interactionPropertyValue"
    }
]
```

-   If the array contains multiple entries, they will be executed in order (e.g. duplicate records, and then refresh the query).
-   `type`: Required. Must be the exact interaction name as listed in `list_interactions`. Never invent a name.
-   All other properties from `get_interaction_docs` are placed directly at the root level of the object.

## Interactions Linked to a Specific Element (`targetName`)

If the component interaction properties include a `targetName` property, it must be included in the interaction definition. The `targetName` value must match the `name` of one of the component's defined element (e.g. an action name). Refer to the `aiDescription` of the `targetName` to determine what component property triggers the interaction.

```json
"actions": [{ "name": "sayHi", "label": "Say hi" }],
"evtActionClick": [
    {
        "targetName": "sayHi",
        "type": "ShowToastEvent",
        "showToastEventTitle": "Hi!",
        "showToastEventMessage": "Welcome to the show!"
    }
]
```

If multiple entries with the same `targetName` value coexist in the same array, they will be executed in order.

## Conditional Interaction Properties

Some interaction properties are conditional (`"when": { condition }`). You can only use them if the interaction value matches the condition. This works the same way as conditional component properties.

## Reference to Objects and Fields

If an interaction value references an object or a field API name, you have to read `get-object-documentation.md`.

## Nested Interactions

Interaction properties can be of type `interactions[]`. These nested interaction properties should use the same structure. For example:

```json
"evtHeaderActionClick": [
    {
        "type": "OpenConfirm",
        "confirmLabel": "Delete the Selected Records",
        "confirmMessage": "This action is irreversible.",
        "confirmTheme": "warning",
        "confirmNextInteractions": [
            {
                "type": "DeleteSelectedRecordsConfirmation",
                "deleteSelectedRecordsSuccessNextInteractions": [
                    {
                        "type": "ShowToastEvent",
                        "showToastEventTitle": "Records Deleted",
                        "showToastEventMessage": "The records have been successfully deleted."
                    }
                ]
            }
        ]

    }
]
```

## Validation Requirements (Mandatory)

Before producing final code, verify:

-   Every interaction `type` exists in the `list_interactions` output.
-   Every property comes from `get_interaction_docs` for that interaction.
-   Every `targetName` matches a `name` defined in the component's corresponding property array.
-   Conditional properties are only used when their condition is met.

If any check fails, fix it before output.

### Unknown or Ambiguous Request

-   Never generate an interaction type or property that is not explicitly listed in the MCP docs.
-   If a type or property name seems plausible but is not in the docs, do not use it — ask the user to clarify instead.
