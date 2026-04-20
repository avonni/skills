# Nested Queries

Nested queries allow fetching related objects in a hierarchical structure. They are only valid for `dcTree` and `dcRelationshipGraph` components. For all other components, use a standard flat query.

## Structure

`nestedQueries` is an array defined at the top level of a query object. Each entry represents a parent object with optional child relationships, and can itself contain a `nestedQueries` array for deeper nesting. There is no maximum depth.

```json
{
    "apiName": "getAccountsContacts",
    "id": "uuid-v4",
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
