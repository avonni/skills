# Component Styling Instructions

## Execution Workflow

1. Call `get_component_styles` once per component that needs styling:
    - Pass the component name as a single `name` string input.
    - Never batch multiple components into one call.
2. Identify the styling hooks or CSS properties that fit the user request.
3. Create the inline CSS string.

## Format of styling hook names

Styling hooks are CSS variables that you use to update specific properties in a component's styling.
By convention, styling hooks `name` follow this format: `namespace-component-property-modifier`

**Conditional styling hooks**: Some styling hooks are conditional (`"when": { condition }`). You can use them only if the component value matches the condition.
For example, `"when": { "variant": ["bare", "destructive" ] }` means this styling hook can be used only if the component value contains `bare` or `destructive` as a `variant`.

**Dynamic names**: Some styling hooks contain a dynamic variable that needs to be replaced by the component value.
For example, in `--avcmpbuilder-button-{!variant}-inline-start`, `{!variant}` should be replaced by the component variant value.

## Validation Requirements (Mandatory)

The output is an inline style CSS string of `<property>: <value>;` pairs.
Before producing final code, verify:

-   Every CSS property or styling hook comes from the MCP response.
-   Every token used exists in the MCP response.

If any check fails, fix it before output.

### Unknown or Ambiguous request

-   Never generate a CSS property or a styling hook that is not explicitly defined in the documentation, even if the name seems plausible or close to an existing one.
