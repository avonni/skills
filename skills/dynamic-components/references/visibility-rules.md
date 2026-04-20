# Visibility rules

## Simple condition

```json
"visibilityRule": {
    "left": {
        "field": "{!Combobox1.value}",
        "operator": "eq",
        "value": "optionA"
    }
}
```

## Compound condition

```json
"visibilityRule": {
    "left": { /* ... */ },
    "logicalOperator": "and",
    "right": { /* ... */ }
}
```

-   `field` references must use `"{!...}"` syntax
-   Allowed logical operators: `and`, `or`

## Allowed operators

Equality:

-   `eq` — equal to
-   `ne` — not equal to

String (only valid when both sides are strings):

-   `sw` — starts with
-   `ew` — ends with
-   `ctn` — contains

Numeric (both sides are cast to Number):

-   `lt` — less than
-   `lte` — less than or equal
-   `gt` — greater than
-   `gte` — greater than or equal

Null checks (no `value` field required):

-   `null` — resource is null
-   `notNull` — resource is not null

Collection (operates on array length; no `value` field required for `empty`/`notEmpty`):

-   `empty` — collection is empty
-   `notEmpty` — collection is not empty
-   `lengthEq` — length equals value
-   `lengthNe` — length does not equal value
-   `lengthLt` — length less than value
-   `lengthLte` — length less than or equal to value
-   `lengthGt` — length greater than value
-   `lengthGte` — length greater than or equal to value

**Important:** For `null`, `notNull`, `empty`, and `notEmpty`, omit the `value` field entirely. For all other operators, `value` is required. Never invent operator names — any operator not in this list will silently evaluate to `false`.
