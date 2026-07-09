# Component Styling Instructions

## Execution Workflow

1. Call `get_component_styles` with `toolset: "dynamic"` once per component that needs styling:
    - Pass the component name as a single `name` string input.
    - Never batch multiple components into one call.
    - If the result was already cached, use it instead of calling the tool again.
    - Do not call `get_component_styles` for the same component twice.
2. Identify the styling hooks or CSS properties that fit the user request.
3. If any selected hooks reference token categories, call `get_style_tokens` with `toolset: "dynamic"` once per styling session (not once per component):
    - Pass only the token categories referenced by the hooks you plan to use.
    - Skip this call if no hooks require token values.
4. Create the inline CSS string and save it in `value.inlineStyle`. It is a string, not an object:

```json
"value": {
    "inlineStyle": "--avcmpbuilder-button-primary-background: #0070d2; --avcmpbuilder-button-primary-color: white;"
}
```

## Error Handling

If `get_component_styles` fails:

-   Retry once.
-   If it still fails, inform the user and ask whether to continue without component styling.

## Format of Styling Hook Names

Styling hooks are CSS variables that you use to update specific properties in a component's styling.
By convention, styling hooks `name` follow this format: `namespace-component-property-modifier`

**Conditional styling hooks**: Some styling hooks can be used only if a condition is met (`"when": { condition }`).

**Dynamic names**: Some styling hooks contain a dynamic variable that needs to be replaced by the component value.
For example, `--avcmpbuilder-button-{!variant}-inline-start` where the component `variant` is `"primary"` becomes `--avcmpbuilder-button-primary-inline-start`.

## Full-Height Components

To make a component fill the remaining vertical space of the viewport, use this inline style — keep `{{ElementPosition.top}}` as a literal placeholder, do not replace it:

```json
"value": {
    "inlineStyle": "height: calc(100vh - {{ElementPosition.top}} - 1rem);"
}
```

## Validation Requirements (Mandatory)

The output is an inline style CSS string of `<property>: <value>;` pairs.
Before producing final code, verify:

-   Every CSS property or styling hook comes from the MCP response.
-   Every token used exists in the `get_style_tokens` response.

If any check fails, fix it before output.

### Unknown or Ambiguous Request

-   Never generate a CSS property or a styling hook that is not explicitly defined in the documentation, even if the name seems plausible or close to an existing one.
