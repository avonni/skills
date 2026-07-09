# Component Generation Instructions

Your goal is to transform a component building plan into a Dynamic Component JSON structure.

## Top-Level Output Format (Mandatory)

Return exactly this JSON output:

```json
{
    "apiName": "Component_API_Name",
    "description": "Description of the component purpose",
    "objectApiName": "Account",
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
-   `objectApiName` is optional. Set it to the Salesforce object API name (e.g., `"Account"`) when the component is placed on a record page. Omit it otherwise.

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
  "name": "dcPascalCaseName",
  "apiName": "UniqueApiName",
  "value": {
    /* component properties */
  }
  "slots": [/* only if defined for this component */]
}
```

### id

Do not generate or modify this field — the validation script manages it. If updating an existing component, preserve the existing value. If creating a new component, omit this field.

### name

Required. Must be the exact name of the component, as written in its metadata.

### apiName

Required for every component wrapper. Must be unique across the entire value tree, including all nested slot components.

#### Default Naming Pattern

component name without "dc" prefix + incremental integer starting at 1.
Examples: `Card1`, `Card2`, `Alert1`

#### Increment Rules

-   The counter is per component type, not global. `Card1` and `Alert1` can coexist.
-   Traverse the tree depth-first and assign numbers in the order components are encountered.
-   If the same component type appears in different slots or branches, continue the counter — never reset it. For example, two `dcCard` in a container and one `dcCard` in a sibling tab would be `Card1`, `Card2`, `Card3`.

#### Conflict Resolution

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

#### Conditional Properties

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
-   Three data source types exist: `static`, `query`, `variables` and `picklistValues`. Never generate other types.
-   A component **cannot** use more than one data source type at the same time.
-   It is mandatory you read and follow `data-sources.md` to set the correct binding properties for whichever type is needed.
-   **Special case:** If you are using a `dcTree` and/or a `dcRelationshipGraph` component, it is mandatory you also read `nested-data-sources.md`. Its rules replace the **Query Binding** and **Picklist Data Source** sections of `data-sources.md` for those components. The Query Definition structure (filters, `filterVariables`, `filterVariablesTypes`, etc.) still applies.

## References

References are pointers to other elements that you can use as values. They follow different patterns:

-   Component property: `{!<componentApiName>.<propertyName>}` (e.g. `{!Combobox1.value}`);
-   Query: `{!$Query.<apiName>}` (e.g. `{!Query.GetCanadianAccounts}`).
-   Resource: `{!<resourceApiName>}` (e.g. `{!constant1}`).
-   Global references: `{!$<category>.<referenceName>}` (e.g. `{!$Organization.City}`).

### Component Property Reference

A component can reference the value of another component's property using the pattern `{!componentApiName.componentProperty}`.
For example, `{!Header1.title}` is a reference to the value of the `title` property of the `Header1` component.
If a property has an object as a value, it is possible to reference the value of one of its keys. For example, `{!Datatable1.firstSelectedRowSObject.Name}` is a reference to the `Name` key of the `firstSelectedRowSObject` object value, of the `Datatable1` component.

### Query

Reference to a query is only allowed for query data source (see **Query data source** section).

### Resources

Resources are reusable references to a value.
All resources must be in top-level `"resources": []`. If none: `"resources": []`.
Allowed types are `constant`, `formula`, and `variable`.

#### Common Fields for Every Types

-   `apiName`, `description`, `dataType` and `type` are always required.
-   `apiName`: serves as the resource title and unique identifier. It should follow the API Name Rules below, be short and descriptive.
-   `type`: `constant`, `formula` or `variable`.
-   Do not generate or modify `id` — the validation script manages it. Preserve it when updating, omit it when creating.

#### Constant Structure

```json
{
    "apiName": "constant1",
    "description": "<Short description of the constant usage>",
    "dataType": "<boolean | date | datetime | number | text>",
    "defaultValue": "<Default value of this constant>",
    "type": "constant"
}
```

`defaultValue` is required for constant resources.

#### Variable Structure

```json
{
    "apiName": "variable1",
    "description": "<Short description of the variable>",
    "dataType": "<boolean | date | datetime | number | record | text>",
    "defaultValue": "<Default value of this variable>",
    "isCollection": "<Boolean. True if the variable is a list of values>",
    "availability": "<Array of strings. Availability outside of the dynamic component>",
    "type": "variable"
}
```

If the variable needs to be accessed outside of the Dynamic Component, availability should be set. Its value is an array of strings: `["input"] | ["output"] | ["input","output"]`.

#### Formula Structure

```json
{
    "apiName": "formula1",
    "description": "<Short description of the formula>",
    "dataType": "<boolean | date | datetime | number | text>",
    "formula": "<Formula value>",
    "type": "formula"
}
```

`formula` is required for formula resources. Formula syntax = Salesforce formula functions (`TODAY()`, `ABS()`, `IF()`, etc.).

### Global References

Reference to a variable related to the user, the Salesforce org, the dynamic component settings, etc. Pattern: `{!$<Category>.<referenceName>}`.

#### API

All API global variables are of type `string`, referenced using `{!$Api.<name>}`.

-   **Enterprise Server URLs:** `Enterprise_Server_URL_<version>` — `<version>` starts at 25, then increments by 10 up to 610.
-   **Partner Server URLs:** `Partner_Server_URL_<version>` — same range.

#### Component

Variables referenced using `{!$Component.<name>}`.

| Name              | Type       | Availability     |
| ----------------- | ---------- | ---------------- |
| `CurrentDate`     | date       | Always           |
| `CurrentDateTime` | datetime   | Always           |
| `FormFactor`      | string     | Always           |
| `Guid`            | string     | Always           |
| `ObjectApiName`   | string     | Record page only |
| `RecordId`        | string     | Record page only |
| `Record`          | collection | Record page only |

`ObjectApiName`, `RecordId`, and `Record` are only available when `objectApiName` is set (i.e., the component is placed on a record page). `Record`'s properties are the fields of the current page record. For example, `{!$Component.Record.Name}` references the `Name` field of the current record.

#### GlobalConstant

Constants referenced using `{!$GlobalConstant.<name>}`.

| Name          | Type    | Value   |
| ------------- | ------- | ------- |
| `EmptyString` | string  | `""`    |
| `False`       | boolean | `false` |
| `True`        | boolean | `true`  |
| `Null`        | string  | `null`  |

`{!$GlobalConstant.FormFactor}` — collection.

| Name                                    | Type   | Value      |
| --------------------------------------- | ------ | ---------- |
| `{!$GlobalConstant.FormFactor.Phone}`   | string | `"Small"`  |
| `{!$GlobalConstant.FormFactor.Tablet}`  | string | `"Medium"` |
| `{!$GlobalConstant.FormFactor.Desktop}` | string | `"Large"`  |

`{!$GlobalConstant.Flow}` — collection.

| Name                                      | Type   | Value        |
| ----------------------------------------- | ------ | ------------ |
| `{!$GlobalConstant.Flow.Status.Started}`  | string | `"STARTED"`  |
| `{!$GlobalConstant.Flow.Status.Paused}`   | string | `"PAUSED"`   |
| `{!$GlobalConstant.Flow.Status.Finished}` | string | `"FINISHED"` |
| `{!$GlobalConstant.Flow.Status.Error}`    | string | `"ERROR"`    |

#### Location

Variables referenced using `{!$Location.<name>}`.

| Name                        | Type    |
| --------------------------- | ------- |
| `IsAvailable`               | boolean |
| `CurrentPosition.Latitude`  | number  |
| `CurrentPosition.Longitude` | number  |

#### Organization, Profile, User, UserRole

These categories expose the fields of their corresponding Salesforce object as variables. For example, `{!$Organization.City}` or `{!$User.FirstName}`.

#### Permission

`{!$Permission.<DeveloperName>}` — references a Custom Permission by its developer name. Returns a boolean indicating whether the current user has that permission.

#### System

Only `{!$System.OriginDateTime}` is available (type: `datetime`).

## Styling (`inlineStyle`)

-   If the user requests a specific style/UI for a component, you have to read `styling.md`.
-   Save the style in `value.inlineStyle`. It is a string, not an object.
-   CSS declarations separated by `;`
-   Good practice: add spacing between sibling components so they are never visually flush against each other.

### Token Preference (Mandatory):

Always prefer LWC tokens over raw values. Raw values (e.g., `"16px"`) are only acceptable when a token does not match the required style.
Use the fallback value that corresponds to the token's intended value so the style degrades gracefully if the token is unavailable.

-   Correct: `var(--lwc-spacingMedium, 1rem)`
-   Avoid: `16px`

**Spacing Tokens:**
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

### Unknown or Ambiguous Request

-   Never generate JSON with missing required fields or invented values. A response with incomplete required fields is always worse than asking a clarifying question first.
-   Never generate a component wrapper, property key, or icon value that is not explicitly defined in the documentation, even if the name seems plausible or close to an existing one.
