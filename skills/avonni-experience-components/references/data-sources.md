# Data Sources

Components that display a collection (e.g. List) have `dataSources` defined in their documentation. The data source value is a **compact JSON string**.

-   By default, the data source is stored on the component's `items` attribute. Some components (e.g. Map) `dataSources` object define a `name` (e.g. `mapMarkers`). If present, use this component-specific attribute name instead of `items`.
-   Always follow the nested shape documented in the component's `get_component_docs` output.

## Query Data Source

Load Salesforce records and map them into component items.

-   Only map the keys documented in the component's `querySObjectMapping` properties.
-   Use real object and field API names; retrieve them via `references/get-object-documentation.md`.

**Example:**

```json
{
    "type": "query",
    "querySObjectApiName": "Account",
    "queryFilters": {
        "left": {
            "field": "BillingCountry",
            "operator": "eq",
            "value": "Canada"
        }
    },
    "querySObjectMapping": {
        "label": "{{Record.Name}}",
        "name": "{{Record.Id}}",
        "href": "{{Record.Website}}",
        "target": "_self",
        "evtclick": {
            "type": "NavigationMixinNavigate",
            "navigationMixinNavigateType": "standard__recordPage",
            "navigationMixinNavigateRecordPageRecordId": "{{Record.Id}}",
            "navigationMixinNavigateRecordPageActionName": "view"
        }
    },
    "queryOrderBy": [{ "field": "Name", "direction": "DESC NULLS LAST" }],
    "queryLimit": 10
}
```

| Property              | Required | Description                                                                                                                                                                                                    |
| --------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                | yes      | Always `query`.                                                                                                                                                                                                |
| `querySObjectApiName` | yes      | Name of the sObject queried.                                                                                                                                                                                   |
| `queryFilters`        | no       | Optional filters applied to the query. See details below.                                                                                                                                                      |
| `querySObjectMapping` | yes      | Maps each component item key to a record value. Each key accepts a static value (`"standard:account"`), a reference to a record field (`"{{Record.Name}}"`), or a mix (`"Located in {{Record.BillingCity}}"`). |
| `queryOrderBy`        | no       | Optional query order(s). See details below.                                                                                                                                                                    |
| `queryLimit`          | no       | Maximum number of records retrieved.                                                                                                                                                                           |

### Filters

**Example:**

```json
"queryFilters": {
    "left": {
        "field": "Name",
        "operator": "like",
        "value": "%doe"
    },
    "logicalOperator": "and",
    "right": {
        "left": { /* ... */ },
        "logicalOperator": /* ... */,
        "right": { /* ... */ }
    }
}
```

-   `field` must be a field of the queried object. Retrieve valid fields via `references/get-object-documentation.md`.
-   Allowed logical operators: `and`, `or`.
-   Value type should be adapted to the field type (string, boolean, etc.).
-   Filters can be nested indefinitely.
-   Allowed operators:
    -   `eq` — equal to.
    -   `ne` — not equal to.
    -   `lt` — less than (numeric and date fields only).
    -   `lte` — less than or equal (numeric and date fields only).
    -   `gt` — greater than (numeric and date fields only).
    -   `gte` — greater than or equal (numeric and date fields only).
    -   `in` — in (string fields only). Value is an array of strings.
    -   `nin` — not in (string fields only). Value is an array of strings.
    -   `like` — like the given matching pattern (string fields only).

### Orders

Array of order directives in the form of an object with two keys:

-   `field` — API name of the object field on which the sorting is performed.
-   `direction` — Direction of the sorting. Accepted values are `ASC`, `DESC`, `ASC NULLS LAST` and `DESC NULLS LAST`.

## Static Data Source

Fixed, hardcoded items unrelated to any Salesforce object. Follow the static shape documented in the component's property; do not invent keys. The static properties are always nested in a `value` object before they are saved in the component `items` object (or in the component-specific attribute).

**Example:**

```json
{
    "type": "static",
    "value": {
        "items": [
            {
                "label": "Lisa",
                "avatar": { "fallbackIconName": "custom:custom1" },
                "name": "lisa"
            },
            {
                "label": "Loubna",
                "avatar": { "fallbackIconName": "custom:custom9" },
                "name": "loubna"
            }
        ],
        "actions": [
            {
                "label": "Say hi!",
                "name": "sayHi",
                "evtclick": {
                    "type": "OpenAlertModal",
                    "alertModalLabel": "Hi!",
                    "alertModalMessage": "This is an example."
                }
            }
        ]
    }
}
```

## CMS Collection

Reference a dynamic or manual collection of content items, created in the Digital Experiences App.

**Example:**

```json
{
    "type": "cmsCollection",
    "cmsCollection": "20YdM00000CXykrUAD",
    "querySObjectMapping": {
        "label": "{{Record.title}}",
        "imageSrc": "{{Record.url}}"
    }
}
```

| Property              | Required | Description                                                                                                                                                                                                                                                                                                                                      |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`                | yes      | Always `cmsCollection`                                                                                                                                                                                                                                                                                                                           |
| `cmsCollection`       | yes      | CMS collection key or ID. It needs to be provided by the user. The key can be found on the CMS collection page under 'Content Key', it starts with 'MC'. The ID starts with '20Y'.                                                                                                                                                               |
| `querySObjectMapping` | yes      | Maps each component item key to a collection item value. Each key accepts a static value (`"standard:account"`), a reference to a collection item field (`"{{Record.title}}"`), or a mix (`"Published: {{Record.publishedDate}}"`). Valid collection item fields are: `altText`, `contentKey`, `publishedDate`, `sourceType`, `title` and `url`. |

## Rules

-   Never set `items` (or the component-specific attribute) to a shape not documented by `get_component_docs`.
-   The whole value is one JSON string on the attribute; nested objects/interactions inside it stay as plain nested JSON (do not double-encode them).
-   The serialized JSON string output is compacted. No extra space should be included.
