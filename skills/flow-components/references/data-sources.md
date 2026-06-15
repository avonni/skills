# Data Sources

A component's data source mode is controlled by the `itemsTypeSelected` input parameter. Four modes exist: `"static"`, `"query"`, `"variables"`, and `"picklistValues"`.

Before choosing a data source type, check which keys exist in the component's `dataSources` documentation. Only the types present there are available for that component. The correct binding parameters differ per mode — never mix them.

## Entry Names and Parameter Prefixes

-   `dataSources.static` entries are the **exact** parameter names to use (e.g. `itemsSerialized`, `optionsSerialized`, or Data Table's `columns` and `records`).
-   `dataSources.query` and `dataSources.variables` entries are named `<prefix>SObjectMapping` (e.g. `itemsSObjectMapping`). Strip `SObjectMapping` to get the prefix used by the sibling parameters below.
-   The mode parameter is always named exactly `itemsTypeSelected`, whatever the entry prefixes — there is no `<prefix>TypeSelected` variant. Only the sibling binding parameters take the prefix (e.g. `eventsSObject`, `resourcesSObjectMapping`).
-   An entry may declare an `sObjectType` (e.g. `"sObjectType": "R"`): the generic type its records map to in the field's `dataTypeMappings`. Entries without it map to the default type `T`. See **Data Type Mappings** in `references/build-screen-field.md`.

---

## Static Data Source

Use when items are fixed, hardcoded values unrelated to any Salesforce object.

For each static entry you populate, write one input parameter named exactly like the entry, containing the JSON array as an XML-escaped string. Each item's shape is defined by the entry's `properties` array — only use fields listed there.

```xml
<inputParameters>
    <name>itemsTypeSelected</name>
    <value>
        <stringValue>static</stringValue>
    </value>
</inputParameters>
<inputParameters>
    <name>itemsSerialized</name>
    <value>
        <stringValue>[{&quot;label&quot;:&quot;Home&quot;,&quot;name&quot;:&quot;home&quot;,&quot;iconName&quot;:&quot;utility:home&quot;}]</stringValue>
    </value>
</inputParameters>
```

---

## Variable Data Source

Use when items come from a flow resource: the result of a Get Records element, a record collection variable, or another component's record output.

```xml
<inputParameters>
    <name>itemsTypeSelected</name>
    <value>
        <stringValue>variables</stringValue>
    </value>
</inputParameters>
<inputParameters>
    <name>itemsSObject</name>
    <value>
        <elementReference>Get_Accounts</elementReference>
    </value>
</inputParameters>
<inputParameters>
    <name>itemsSObjectApiName</name>
    <value>
        <stringValue>Account</stringValue>
    </value>
</inputParameters>
<inputParameters>
    <name>itemsSObjectMapping</name>
    <value>
        <stringValue>{&quot;label&quot;:&quot;{{Record.Name}}&quot;,&quot;name&quot;:&quot;{{Record.Id}}&quot;}</stringValue>
    </value>
</inputParameters>
```

| Parameter                | Required | Description                                                                                                                                                                                      |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `itemsTypeSelected`      | yes      | Must be `variables`                                                                                                                                                                              |
| `<prefix>SObject`        | yes      | `<elementReference>` to the record collection (a Get Records element name, or another component's property of type `record[]` like `myDataTable.selectedRows`)                                   |
| `<prefix>SObjectApiName` | yes      | The object API name related to the selected record collection                                                                                                                                    |
| `<prefix>SObjectMapping` | yes      | JSON object mapping each component item key to its value. Each key accepts a static value (`"standard:account"`), a record field (`"{{Record.Name}}"`), or a mix (`"In {{Record.BillingCity}}"`) |

The mapping keys are the fields documented in the entry's `properties`. Keep `{{Record.FieldApiName}}` tokens literal — every field API name used in a mapping must come from the objects documentation (read `get-object-documentation.md`). The field must carry its `dataTypeMappings` (see **Data Type Mappings** in `references/build-screen-field.md`).

If a component documents several `dataSources.variables` entries, repeat the parameter group per prefix (e.g. `events*` and `resources*`), with one `dataTypeMappings` block per generic type.

---

## Query Data Source

Use when the component should load Salesforce records itself, directly from the database. The component runs the query — no Get Records element is needed.

```xml
<inputParameters>
    <name>itemsTypeSelected</name>
    <value>
        <stringValue>query</stringValue>
    </value>
</inputParameters>
<inputParameters>
    <name>itemsSObjectApiName</name>
    <value>
        <stringValue>Account</stringValue>
    </value>
</inputParameters>
<inputParameters>
    <name>itemsSObjectMapping</name>
    <value>
        <stringValue>{&quot;label&quot;:&quot;{{Record.Name}}&quot;,&quot;name&quot;:&quot;{{Record.Id}}&quot;}</stringValue>
    </value>
</inputParameters>
```

| Parameter                | Required | Description                                          |
| ------------------------ | -------- | ---------------------------------------------------- |
| `itemsTypeSelected`      | yes      | Must be `query`                                      |
| `<prefix>SObjectApiName` | yes      | The object API name to query                         |
| `<prefix>SObjectMapping` | yes      | Same JSON mapping format as the variable data source |

Query mode also requires a `systemContext` parameter on the field (see **System Context** in `references/build-screen-field.md`).

### Query Options

These optional parameters refine the query. They apply to the component's query as a whole:

| Parameter                      | Value                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `queryFiltersExpression`       | A SOQL `WHERE` clause string, without the `WHERE` keyword (literal, or `<elementReference>` to a text formula for reactive filters) |
| `queryLimit`                   | Maximum number of records (`<numberValue>`)                                                                                         |
| `queryOrderBySerialized`       | JSON array of `{"field":"FieldApiName","direction":"ASC"\|"DESC"}` objects                                                          |
| `queryFieldsSerialized`        | JSON array of extra field API names to query, when referenced outside the mapping                                                   |
| `queryStripInaccessibleFields` | `<booleanValue>` — strip fields the running user cannot access                                                                      |
| `querySystemMode`              | `<booleanValue>` — run the query in system mode                                                                                     |

Only include the options the request needs. Field API names used in filters and order-by must exist on the queried object — never invent them; retrieve them by reading `get-object-documentation.md`.

---

## Picklist Data Source

Use when items are the possible values of a Salesforce picklist field. Available when the component documents a `picklistValues` key (even as an empty array).

```xml
<inputParameters>
    <name>itemsTypeSelected</name>
    <value>
        <stringValue>picklistValues</stringValue>
    </value>
</inputParameters>
<inputParameters>
    <name>itemsSObjectApiName</name>
    <value>
        <stringValue>Account</stringValue>
    </value>
</inputParameters>
<inputParameters>
    <name>picklistFieldApiName</name>
    <value>
        <stringValue>Account.Industry</stringValue>
    </value>
</inputParameters>
```

| Parameter                  | Required | Description                                                                            |
| -------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `itemsTypeSelected`        | yes      | Must be `picklistValues`                                                               |
| `<prefix>SObjectApiName`   | yes      | The object API name                                                                    |
| `picklistFieldApiName`     | yes      | `ObjectApiName.FieldApiName` — the picklist field to load                              |
| `picklistRecordType`       | no       | Scopes the picklist to a specific record type                                          |
| `picklistSortOrder`        | no       | `asc` or `desc`                                                                        |
| `picklistValue`            | no       | Semicolon-delimited allow-list of values to show (all shown if omitted)                |
| `picklistControllingValue` | no       | For dependent picklists: the controlling field's current value(s), semicolon-delimited |
