# Data Sources

A component's data source is controlled by `itemsTypeSelected`. Four modes exist: `"static"`, `"query"`, `"variables"`, and `"picklistValues"`. The correct binding properties differ per mode — never mix them.

Before choosing a data source type, check which keys exist in the component's `dataSources` object. Only the types present there are available for that component. For example, if `dataSources` only contains a `query` key, the component cannot use static, variable or picklist data sources.

---

## Static Data Source

Use when items are statically defined.

A component's `dataSources.static` is an array — each entry is a named collection you must populate separately. Set each one directly in `value` using its `name` as the key.

```json
{
    "itemsTypeSelected": "static",
    "<name1>": [ ... ],
    "<name2>": [ ... ]
}
```

For example, if a component has two static entries (`items` and `resources`), both must be set:

```json
{
    "itemsTypeSelected": "static",
    "items": [
        {
            "name": "msg1",
            "type": "inbound",
            "date": "2026-01-01T10:00:00Z",
            "value": "Hello!"
        }
    ],
    "resources": [{ "name": "user1", "label": "Alice" }]
}
```

Each entry's shape is defined by its own `properties` array in `dataSources.static`. Only use fields listed there.

---

## Variable Data Source

Use when items come from another component's output — for example, when a component displays the selected records of a Datatable.

**Example:**

```json
{
    "itemsTypeSelected": "variables",
    "itemsSObject": "{!Datatable1.selectedRowsSObject}",
    "itemsSObjectApiName": "{!Datatable1.itemsSObjectApiName}",
    "itemsSObjectMapping": {
        "label": "{{Record.Name}}",
        "name": "{{Record.Id}}"
    }
}
```

| Property              | Required | Description                                                                                                                                                                               |
| --------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `itemsTypeSelected`   | yes      | Must be `"variables"`                                                                                                                                                                     |
| `itemsSObject`        | yes      | Reference to the source component's records output property (`{!<componentApiName>.<propertyName>}`)                                                                                      |
| `itemsSObjectApiName` | yes      | Reference to the source component's `itemsSObjectApiName` property (`{!<componentApiName>.itemsSObjectApiName}`)                                                                          |
| `itemsSObjectMapping` | yes      | Maps each component item key to its value. Each key accepts a static value (`"standard:account"`), a record field (`"{{Record.Name}}"`), or a mix (`"Located in {{Record.BillingCity}}"`) |

Some components expose additional properties under `dataSources.variables`. Set each one as a reference to an output property, similarly to `itemsSObject`.

---

## Picklist Data Source

Use when items come from a Salesforce picklist field. A component can use a picklist data source when it has a `picklistValues` array set, even if this array is empty.

**Example:**

```json
{
    "itemsTypeSelected": "picklistValues",
    "picklistFieldApiName": "Account.Industry",
    "picklistRecordType": "Business",
    "picklistSortOrder": "asc",
    "picklistValue": "Agriculture;Biotechnology",
    "picklistControllingValue": "USA"
}
```

| Property                   | Required | Description                                                                                                                                      |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `picklistFieldApiName`     | yes      | `"ObjectApiName.FieldApiName"` — the picklist field to load                                                                                      |
| `picklistRecordType`       | no       | Scopes the picklist to a specific record type                                                                                                    |
| `picklistSortOrder`        | no       | `"asc"` or `"desc"`                                                                                                                              |
| `picklistValue`            | no       | Semicolon-delimited allow-list of values to show (all shown if omitted)                                                                          |
| `picklistControllingValue` | no       | For dependent picklists: the controlling field's current value(s), semicolon-delimited. Filters options to those whose `validFor` index matches. |

---

## Query Data Source

When a component uses a query as its data source, a query definition has to be created. All query definitions must be in top-level `"queries": []`. If no query is used: `"queries": []`.

### Query Definition

```json
{
    "apiName": "getAccounts",
    "objectApiName": "Account",
    "filter": "<Filter string including references to variables>",
    "filterVariables": {
        /* <variableName: variableValue> */
    },
    "filterVariablesTypes": {
        /* <variableName: variableType> */
    },
    "orderBy": "Id ASC",
    "queryLimit": "<Integer>"
}
```

-   `apiName` and `objectApiName` are mandatory. Do not generate or modify `id` — the validation script manages it. Preserve it when updating, omit it when creating.
-   `filter`, `filterVariables`, `filterVariablesTypes`, `orderBy` and `queryLimit` are optional.

#### Query Filters

`filter` is the SOQL WHERE clause only (no `WHERE` keyword).

-   Every field value mentioned in `filter` must be transformed into a variable.
-   Variables use `:variableName` placeholders.
-   If the filter contains any `:variableName` placeholder, you **must** include both `filterVariables` and `filterVariablesTypes`. Every placeholder must exist as a key in both objects — 1:1, exact match.
-   Never add keys to `filterVariables` and `filterVariablesTypes` that are not referenced in `filter`.

#### filterVariables

Maps each placeholder to its runtime value (static value or reference).

#### filterVariablesTypes

Maps each placeholder to its Salesforce field type. Allowed types: `String`, `Number`, `Boolean`, `Date`, `DateTime`, `Double`, `Int`, `Time`, `Id`

#### Example — Filter with Mixed Variable Types

```json
{
    "apiName": "get_accounts",
    "objectApiName": "Account",
    "filter": "Industry IN (:variable1item0, :variable1item1, :variable1item2) AND (Name LIKE :variable2 OR CreatedDate >= :variable3)",
    "filterVariables": {
        "variable1item0": "Agriculture",
        "variable1item1": "Biotechnology",
        "variable1item2": "Chemicals",
        "variable2": "{!$GlobalConstant.EmptyString}",
        "variable3": "2026-03-24T05:41:41Z"
    },
    "filterVariablesTypes": {
        "variable1item0": "String",
        "variable1item1": "String",
        "variable1item2": "String",
        "variable2": "String",
        "variable3": "DateTime"
    }
}
```

### Query Binding

Use when items come from a query result.

**Example:**

```json
{
    "itemsTypeSelected": "query",
    "itemsSObject": "{!$Query.getAccounts}",
    "itemsSObjectApiName": "Account",
    "nbItems": "{!$Query.getAccounts.nbItems}",
    "itemsSObjectMapping": {
        "label": "{{Record.Name}}",
        "name": "{{Record.Id}}",
        "description": "Located in {{Record.BillingCity}}",
        "iconName": "standard:account"
    }
}
```

| Property              | Required | Description                                                                                                                                                                               |
| --------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `itemsTypeSelected`   | yes      | Must be `"query"`                                                                                                                                                                         |
| `itemsSObject`        | yes      | `"{!$Query.<apiName>}"` — reference to the query                                                                                                                                          |
| `itemsSObjectApiName` | yes      | Must equal the `objectApiName` of the referenced query                                                                                                                                    |
| `nbItems`             | yes      | `"{!$Query.<apiName>.nbItems}"` — the query result count                                                                                                                                  |
| `itemsSObjectMapping` | yes      | Maps each component item key to its value. Each key accepts a static value (`"standard:account"`), a record field (`"{{Record.Name}}"`), or a mix (`"Located in {{Record.BillingCity}}"`) |
