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

#### Date Literals and Date Functions

A SOQL date literal (`TODAY`, `THIS_MONTH`, `LAST_N_DAYS:30`, `NEXT_N_WEEKS:2`…) is a variable value. Type the variable like the field, `Date` or `DateTime`:

```json
{
    "filter": "CloseDate = :variable1 AND CreatedDate = :variable2",
    "filterVariables": {
        "variable1": "THIS_QUARTER",
        "variable2": "LAST_N_DAYS:30"
    },
    "filterVariablesTypes": {
        "variable1": "Date",
        "variable2": "DateTime"
    }
}
```

A SOQL date function compares a part of a Date or DateTime field: `CALENDAR_MONTH`, `CALENDAR_QUARTER`, `CALENDAR_YEAR`, `DAY_IN_MONTH`, `DAY_IN_WEEK`, `DAY_IN_YEAR`, `DAY_ONLY`, `FISCAL_MONTH`, `FISCAL_QUARTER`, `FISCAL_YEAR`, `HOUR_IN_DAY`, `WEEK_IN_MONTH` and `WEEK_IN_YEAR`. Its variable is a `Number`, except for `DAY_ONLY`, which is a `Date`:

```json
{
    "filter": "CALENDAR_YEAR(CloseDate) = :variable1 AND DAY_ONLY(CreatedDate) = :variable2",
    "filterVariables": {
        "variable1": "2025",
        "variable2": "2025-12-13"
    },
    "filterVariablesTypes": {
        "variable1": "Number",
        "variable2": "Date"
    }
}
```

#### Filter by Distance

To keep the records within a distance of a point, compare the `DISTANCE()` of a location field to a radius:

```
DISTANCE(BillingAddress, GEOLOCATION(:variable1, :variable2), 'km') < :variable3
```

-   The location field is a compound Address field (`BillingAddress`, `ShippingAddress`, `MailingAddress`…) or a Geolocation custom field (`Location__c`). Never use its separate latitude and longitude fields.
-   Only `<` (within the radius) and `>` (beyond the radius) are allowed. Never wrap `DISTANCE()` in `NOT()`.
-   The unit is `'km'` or `'mi'`, written in the filter, never as a variable.
-   The latitude, longitude and radius are variables of type `Double`.
-   When the latitude, longitude or radius is empty at runtime, the condition matches no record.
-   An Address field only has coordinates once Salesforce geocodes it, which needs the matching Data Integration Rule (for example "Geocodes for Account Billing Address"). Records without coordinates never match.

Common centers:

| Center                            | Latitude                                        | Longitude                                        |
| --------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| Current user position             | `{!$Location.CurrentPosition.Latitude}`         | `{!$Location.CurrentPosition.Longitude}`         |
| Account picked in a Record Picker | `{!CenterAccount.valueSObject.BillingLatitude}` | `{!CenterAccount.valueSObject.BillingLongitude}` |

`$Location` is described in [Global References](build-component.md#location). It asks the user to share their location when the component loads.

#### Order by Distance

`orderBy` can sort the records by their distance to a point:

```
DISTANCE(BillingAddress, GEOLOCATION(45.5017, -73.5673), 'km') ASC NULLS LAST
```

-   `orderBy` has no variables. Write the latitude and longitude inline, as numbers or as references (`{!$Location.CurrentPosition.Latitude}`). Never use `:placeholders` in `orderBy`.
-   A distance order must be the only order. The record ID is added after it automatically.
-   Use `ASC NULLS LAST` to list the nearest records first and the records without location last. Without `NULLS LAST`, the records without location come first.
-   When the latitude or longitude is empty at runtime, the order is dropped and the records come back ordered by ID.

#### Example — Nearest Accounts Around a Picked Account

A Record Picker named `CenterAccount` picks an Account. The query lists the other Accounts within 10 km of it, nearest first:

```json
{
    "apiName": "nearby_accounts",
    "objectApiName": "Account",
    "filter": "DISTANCE(BillingAddress, GEOLOCATION(:variable1, :variable2), 'km') < :variable3 AND Id != :variable4",
    "filterVariables": {
        "variable1": "{!CenterAccount.valueSObject.BillingLatitude}",
        "variable2": "{!CenterAccount.valueSObject.BillingLongitude}",
        "variable3": "10",
        "variable4": "{!CenterAccount.value}"
    },
    "filterVariablesTypes": {
        "variable1": "Double",
        "variable2": "Double",
        "variable3": "Double",
        "variable4": "Id"
    },
    "orderBy": "DISTANCE(BillingAddress, GEOLOCATION({!CenterAccount.valueSObject.BillingLatitude}, {!CenterAccount.valueSObject.BillingLongitude}), 'km') ASC NULLS LAST"
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

Never set `queryFields` yourself: `create-component.mjs` fills it with the fields the component reads (mapping, interactions, columns, etc.) when it writes the metadata. When editing, leave existing `queryFields` as they are.
