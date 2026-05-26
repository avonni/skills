# Nested Data Sources

Nested data sources are only valid for components that display items in a hierarchical structure (`dcTree` and `dcRelationshipGraph`).

## Nested Picklists

Nested picklists allow building a hierarchical tree that reflects a Salesforce controlling/dependent picklist relationship. The parent level maps to the controlling field, and each child level maps to a dependent field whose available values are filtered by the parent's selected value. This is only valid for `dcTree`.

Set inside `value`:

-   `"itemsTypeSelected": "picklistValues"`
-   `"itemsSObjectApiName": "<ObjectApiName>"` — the Salesforce object the picklist fields belong to
-   `"picklistItems": [ ... ]` — array of picklist field nodes, ordered from controlling field (root) to deepest dependent field

### `picklistItems` Structure

Each entry in `picklistItems` represents one level of the controlling/dependent chain. The structure is recursive: a node can contain `items` with the same shape, allowing chains of multiple dependency levels.

```json
{
    "itemsTypeSelected": "picklistValues",
    "itemsSObjectApiName": "Account",
    "picklistItems": [
        {
            "label": "Country",
            "name": "Account.avxp__Country__c",
            "expanded": true,
            "items": [
                {
                    "label": "State",
                    "name": "Account.avxp__State__c",
                    "items": []
                }
            ]
        }
    ]
}
```

| Property   | Required | Description                                                               |
| ---------- | -------- | ------------------------------------------------------------------------- |
| `name`     | yes      | `"ObjectApiName.FieldApiName"` — the picklist field to load at this level |
| `label`    | yes      | Field label.                                                              |
| `items`    | yes      | Child picklist nodes. Use an empty array `[]` for leaf nodes              |
| `expanded` | no       | If `true`, this node is expanded by default                               |

## Nested Queries

Nested queries allow fetching related objects in a hierarchical structure. For all other components, use a standard flat query.

### Structure

`nestedQueries` is an array defined at the top level of a query object. Each entry represents a parent object with optional child relationships, and can itself contain a `nestedQueries` array for deeper nesting. There is no maximum depth.

```json
{
    "apiName": "getAccountsContacts",
    "nestedQueries": [
        {
            "objectApiName": "Account",
            "customFields": ["..."],
            "nestedQueries": [
                {
                    "objectApiName": "Opportunity",
                    "customFields": ["AccountId"]
                },
                {
                    "objectApiName": "Contact",
                    "customFields": ["AccountId"]
                }
            ]
        }
    ]
}
```

-   `nestedQueries` replaces `objectApiName` at the top level of the query — do not set both.
-   `customFields` is optional on any nested object. Include it only when specific fields are needed.
-   Each `nestedQueries` entry can itself contain a `nestedQueries` array for unlimited depth.
-   Multiple top-level objects are supported by adding multiple entries to the top-level `nestedQueries` array.
