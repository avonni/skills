# Component Generation Instructions

Your goal is to transform a component building plan into a Dynamic Component JSON structure.

## Top-Level Output Format (Mandatory)

Return exactly this JSON output:

```json
{
    "apiName": "Component_API_Name",
    "description": "Description of the component purpose",
    "value": [
        /* one or more root component wrappers */
    ],
    "queries": [
        /* query definitions */
    ],
    "resources": [
        /* resource definitions */
    ]
}
```

-   If no queries/resources/value is needed, return empty arrays: `"queries": []`, `"resources": []`, `"value": []`.
-   `apiName` is required (max 30 characters). It serves as the title of the component. For example, "Account_Dashboard".
-   `description` is optional (max 255 characters). It serves as the description of the component. For example, "A dashboard that displays account details".

## API Name Rules (Global)

All `apiName` fields across the entire output — top-level output, component wrappers, queries, and resources — must follow these rules:

-   Must begin with a letter
-   May only contain alphanumeric characters and underscores (`A–Z`, `a–z`, `0–9`, `_`)
-   Cannot end with an underscore
-   Cannot contain two consecutive underscores

These rules apply to every `apiName` in the output without exception. Validate all generated `apiName` values against these rules before returning the response.

## Component Wrapper Format (Mandatory)

Each component must use this wrapper:

```json
{
  "id": "uuid-v4",
  "name": "dcPascalCaseName",
  "apiName": "UniqueApiName",
  "value": {
    /* component properties */
  }
  "slots": [/* only if defined for this component */]
}
```

### id

Required. UUID v4.

### name

Required. Must be the exact name of the component, as written in its metadata.

### apiName

Required for every component wrapper. Must be unique across the entire value tree, including all nested slot components.

#### Default naming pattern

component name + incremental integer starting at 1.
Examples: `dcCard1`, `dcCard2`, `dcAlert1`

#### Increment rules

-   The counter is per component type, not global. `dcCard1` and `dcAlert1` can coexist.
-   Traverse the tree depth-first and assign numbers in the order components are encountered.
-   If the same component type appears in different slots or branches, continue the counter — never reset it. For example, two `dcCard` in a container and one `dcCard` in a sibling tab would be `dcCard1`, `dcCard2`, `dcCard3`.

#### Conflict resolution

-   Before finalizing output, verify no two components share the same `apiName`. If a conflict is detected, increment the suffix of the later component until the value is unique.
-   Never reuse an `apiName` even if a component is in a different branch of the tree.

#### Exception

Components with special rules (e.g., `dcContainer` inside `dcTabbedContainer`) override this format — see the Component-Level Instructions section.

### value

Contains only properties defined in the component definition for that component. Do not put slot content in `value`. Include required properties. Optional properties only if requested/needed.

#### Icon Rules (Strict)

For any property of type `icon`:

-   Use only valid Salesforce Lightning Design System icons, in the format `category:icon-name` (for example `standard:account`).
-   Never invent icons.

#### Conditional properties

Some properties can be used only if a condition is met (`"when": { condition }`). You can use them only if the component value matches the condition.
For example:

-   `"when": { "variant": ["bare", "destructive" ] }` means this property can be used only if the component value contains `bare` or `destructive` as a `variant`.
-   `"when": { "variant": true }` means this property can be used if any variant value is set.

## Slots

Include `"slots"` only if the component definition declares at least one slot. If the component has no slots, omit `slots` entirely — never output `"slots": []`.

```json
"slots": [
 { "name": "slotName", "components": [ /* wrapped components */ ] }
]
```

-   `components` is always an array (even if only one component).
-   Each nested component is a full wrapper object (`id`/`name`/`apiName`/`value`, and `slots` only if defined).

## Component-Level Instructions

Some components include additional LLM instructions directly in their component definition. These instructions override global rules when there is a conflict — component-level instructions always take priority.
When processing a component, always check its definition for an additional instructions block before applying global rules.

## Data Display Components: `dataSources`

-   If a component definition contains `dataSources`, it is a data display component.
-   Only `manual` and `query` data source types are used. Never generate other types.
-   A component **cannot** use both manual and query at the same time.

### Manual data source

Place data in `value.<manualPropertyName>` where `<manualPropertyName>` comes from `dataSources[].property`. Only use fields defined in the manual datasource schema.

### Query data source

-   Do not populate the manual data source property (e.g., do not set `items`).
-   If a component has a query data source, it is mandatory you read and follow the `queries.md` rules.
-   **Special case:** If you are using a `dcTree` and/or a `dcRelationshipGraph` component, it is mandatory you also read and follow the `nested-queries.md` rules.

## Resources

Resources are reusable references to a value.
All resources must be in top-level `"resources": []`. If none: `"resources": []`.
Allowed types are `constant`, `formula`, and `variable`.

### Constant structure

```json
{
    "apiName": "constant1",
    "id": "uuid-v4",
    "description": "<Short description of the constant usage>",
    "dataType": "<boolean | date | datetime | number | text>",
    "defaultValue": "<Default value of this constant>",
    "type": "constant"
}
```

-   All fields are required.
-   `type` is always equal to "constant".

### Variable structure

```json
{
    "apiName": "variable1",
    "id": "uuid-v4",
    "description": "<Short description of the variable>",
    "dataType": "<boolean | date | datetime | number | record | text>",
    "defaultValue": "<Default value of this variable>",
    "isCollection": "<Boolean. True if the variable is a list of values>",
    "availability": "<Array of strings. Availability outside of the dynamic component>",
    "type": "variable"
}
```

-   Required fields: `apiName`, `description`, `dataType`, `id`.
-   It is mandatory that `type` is "variable".
-   If the variable needs to be accessed outside of the Dynamic Component, availability should be set. Its value is an array of strings: `["input"] | ["output"] | ["input","output"]`.

### Formula structure

```json
{
    "apiName": "formula1",
    "id": "uuid-v4",
    "description": "<Short description of the formula>",
    "dataType": "<boolean | date | datetime | number | text>",
    "formula": "<Formula value>",
    "type": "formula"
}
```

-   Required fields: `apiName`, `description`, `dataType`, `formula`, `id`,
-   It is mandatory that `type` is "formula".
-   Formula syntax = Salesforce formula functions (`TODAY()`, `ABS()`, `IF()`, etc.)

### Resource references

To reference a resource in a component property, use the pattern `{!resourceApiName}`.

Do not confuse:

-   Resource: `{!myVariable}`
-   Query: `{!$Query.getAccounts}`
-   Component property: `{!Combobox1.value}`

## Component property reference

A component can reference the value of another component's property using the pattern `{!componentApiName.componentProperty}`.
For example, `{!dcHeader1.title}` is a reference to the value of the `title` property of the `dcHeader1` component.
If a property has an object as a value, it is possible to reference the value of one of its keys. For example, `{!dcDatatable1.firstSelectedRowSObject.Name}` is a reference to the `Name` key of the `firstSelectedRowSObject` object value, of the `dcDatatable1` component.

## Styling (`inlineStyle`)

-   If the user requests a specific style/UI for a component, you have to read `styling.md`.
-   Save the style in `value.inlineStyle`. It is a string, not an object.
-   CSS declarations separated by `;`
-   Good practice: add spacing between sibling components so they are never visually flush against each other.

### Token preference (mandatory):

Always prefer LWC tokens over raw values. Raw values (e.g., `"16px"`) are only acceptable when a token does not match the required style.
Use the fallback value that corresponds to the token's intended value so the style degrades gracefully if the token is unavailable.

-   Correct: `var(--lwc-spacingMedium, 1rem)`
-   Avoid: `16px`

**Spacing tokens:**
`--lwc-spacingNone` · `--lwc-spacingXxxSmall` · `--lwc-spacingXxSmall` · `--lwc-spacingXSmall` · `--lwc-spacingSmall` · `--lwc-spacingMedium` · `--lwc-spacingLarge` · `--lwc-spacingXLarge` · `--lwc-spacingXxLarge`

## Interactions

If you need to use a property of type `interaction[]`, you have to read `interactions.md`.

## Visibility Rules

If the user requests conditional visibility, add `visibilityRule` inside `value`. Read the `visibility-rules.md` rules and apply them to your output.

## Validation Requirements (Mandatory)

The output is a JSON only (no markdown).
Before producing final code, verify:

-   Every component exists in MCP
-   Every property exists
-   Every slot exists
-   All required properties are present
-   No undocumented APIs are used
-   You produced a valid JSON.
-   There is no trailing commas.

If any check fails, fix it before output.

### Unknown or Ambiguous request

-   Never generate JSON with missing required fields or invented values. A response with incomplete required fields is always worse than asking a clarifying question first.
-   Never generate a component wrapper, property key, or icon value that is not explicitly defined in the documentation, even if the name seems plausible or close to an existing one.
