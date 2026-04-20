# Queries

When a component uses a query as its data source, a query definition has to be created. All query definitions must be in top-level `"queries": []`. If no query is used: `"queries": []`.

## Query structure

```json
{
    "apiName": "getAccounts",
    "id": "uuid-v4",
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

-   `apiName`, `id` and `objectApiName` are mandatory.
-   `filter`, `filterVariables`, `filterVariablesTypes`, `orderBy` and `queryLimit` are optional.

## Query Filters

`filter` is the SOQL WHERE clause only (no `WHERE` keyword).

-   Every field value mentioned in `filter` must be transformed into a variable.
-   Variables use `:variableName` placeholders.
-   If the filter contains any `:variableName` placeholder, you **must** include both `filterVariables` and `filterVariablesTypes`. Every placeholder must exist as a key in both objects — 1:1, exact match.
-   Never add keys to `filterVariables` and `filterVariablesTypes` that are not referenced in `filter`.

### filterVariables

Maps each placeholder to its runtime value. Allowed values:

-   Static values: `"Agriculture"`, `42`, `true`
-   Reference to another component: `"{!Combobox1.value}"`
-   Global reference: `"{!$Component.CurrentDate}"`
-   Reference to a resource: `"{!myVariable}"`

### filterVariablesTypes

Maps each placeholder to its Salesforce field type. Allowed types: `String`, `Number`, `Boolean`, `Date`, `DateTime`, `Double`, `Int`, `Time`, `Id`

### Example — filter with mixed variable types

```json
{
    "apiName": "get_accounts",
    "id": "uuid-v4",
    "objectApiName": "Account",
    "filter": "Industry IN (:variable1item0, :variable1item1, :variable1item2) AND (Name LIKE :variable2 OR CreatedDate >= :variable3)",
    "filterVariables": {
        "variable1item0": "Agriculture",
        "variable1item1": "Biotechnology",
        "variable1item2": "Chemicals",
        "variable2": "{!$Component.ObjectApiName}",
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

## Query binding (mandatory pattern)

When using query data source in a component set inside `value`:

-   `"itemsTypeSelected": "query"`
-   `"itemsSObject": "{!$Query.<apiName>}"`
-   `"itemsSObjectApiName": "<ObjectApiName>"` — must always equal the `objectApiName` of the referenced query
-   `"nbItems": "{!$Query.<apiName>.nbItems}"`
-   `"itemsSObjectMapping": { ... }` — uses `{{Record.FieldName}}`
