# Interactions

Interactions define what happens in response to a user event on a component — for example, navigating to a record when an item is clicked, or showing a toast when an action button is pressed. They are configured on component properties of type `interaction[]` (named `evt*`), which correspond to specific events exposed by the component.

## Execution Workflow

Before writing any interaction:

1. Call `list_interactions` with `toolset: "flow"` to get the list of available interactions.
    - If you already called this tool, use the cached result. Do not call `list_interactions` twice.
2. For each interaction you plan to use, call `get_interaction_docs` once with `toolset: "flow"` and the interaction name.
    - Never batch multiple interactions into one call.
    - Never assume the properties of an interaction — always retrieve its docs.
    - If you already called this tool, use the cached result. Do not call `get_interaction_docs` for the same interaction twice.
3. Identify the properties that match the required behavior.
4. Write the interaction parameter using the format below.

## Error Handling

If `list_interactions` or `get_interaction_docs` fails:

-   Retry once.
-   If it still fails, inform the user and ask whether to continue without that interaction.

## Parameter Format

An `evt*` property is one input parameter whose value is a JSON **array** of interaction objects, XML-escaped, under the property's own name:

```xml
<inputParameters>
    <name>evtActionClick</name>
    <value>
        <stringValue>[{&quot;targetName&quot;:&quot;sayHi&quot;,&quot;type&quot;:&quot;ShowToastEvent&quot;,&quot;showToastEventTitle&quot;:&quot;Hi!&quot;,&quot;showToastEventVariant&quot;:&quot;success&quot;}]</stringValue>
    </value>
</inputParameters>
```

-   If the array contains multiple entries, they will be executed in order (e.g. update the record, and then refresh the queries).
-   `type`: Required. Must be the exact interaction name as listed in `list_interactions`. Never invent a name.
-   All other properties from `get_interaction_docs` are placed directly at the root level of the object.

## Interactions Linked to a Specific Element (`targetName`)

If the component interaction properties include a `targetName` property, it must be included in the interaction definition. The `targetName` value must match the `name` of one of the component's defined elements (e.g. an action name defined in the component's actions collection).

If multiple entries with the same `targetName` value coexist in the same array, they will be executed in order.

## Record Context Tokens

Inside interaction values, `{{Record.FieldApiName}}` tokens reference the record tied to the item the user interacted with (only when the component uses a query or variable data source). Keep them literal — they are resolved at runtime:

```json
[
    {
        "type": "NavigationMixinNavigate",
        "navigationMixinNavigateType": "standard__recordPage",
        "navigationMixinNavigateRecordPageRecordId": "{{Record.Id}}"
    }
]
```

Only use field API names that exist on the data source's object.

## Reference to Objects and Fields

If an interaction value references an object or a field API name, you have to read `get-object-documentation.md`.

## Conditional Interaction Properties

Some interaction properties are conditional (`"when": { condition }`). You can only use them if the interaction value matches the condition. This works the same way as conditional component properties.

## Nested Interactions

Interaction properties can themselves be of type `interaction[]` (e.g. a confirmation dialog's next interactions). These nested interaction properties use the same object structure:

```json
[
    {
        "type": "OpenConfirm",
        "confirmLabel": "Delete the Selected Records",
        "confirmMessage": "This action is irreversible.",
        "confirmTheme": "warning",
        "confirmNextInteractions": [
            {
                "type": "DeleteSelectedRecordsConfirmation"
            }
        ]
    }
]
```

Only nest interaction types the parent property documentation explicitly accepts.

## Query Refreshing Interactions

If any interaction refreshes queries (e.g. Refresh All Queries), the field must have a `systemContext` parameter (see `references/build-screen-field.md`).

## Validation Requirements (Mandatory)

Before producing final XML, verify:

-   Every interaction `type` exists in the `list_interactions` output.
-   Every property comes from `get_interaction_docs` for that interaction.
-   Every `targetName` matches a `name` defined in the component's corresponding collection.
-   Conditional properties are only used when their condition is met.
-   The JSON array is valid and XML-escaped.

If any check fails, fix it before output.

### Unknown or Ambiguous Request

-   Never generate an interaction type or property that is not explicitly listed in the MCP docs.
-   If a type or property name seems plausible but is not in the docs, do not use it — ask the user to clarify instead.
