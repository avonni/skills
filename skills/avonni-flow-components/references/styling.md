# Component Styling Instructions

## Execution Workflow

1. Call `get_component_styles` with `toolset: "flow"` once per component that needs styling:
    - Pass the component name as a single `name` string input.
    - Never batch multiple components into one call.
    - If the result was already cached, use it instead of calling the tool again.
    - Do not call `get_component_styles` for the same component twice.
2. Identify the styling hooks or CSS properties that fit the user request.
3. If any selected hooks reference token categories, call `get_style_tokens` with `toolset: "flow"` once per styling session (not once per component):
    - Pass only the token categories referenced by the hooks you plan to use.
    - Skip this call if no hooks require token values.
4. Write the inline CSS string into the field's `inlineStyle` input parameter. It is a plain CSS declarations string of `<property>: <value>;` pairs:

```xml
<inputParameters>
    <name>inlineStyle</name>
    <value>
        <stringValue>margin-top: var(--lwc-spacingMedium, 1rem); --avonni-alert-base-color-background: #0176d3;</stringValue>
    </value>
</inputParameters>
```

Mix standard CSS properties (from the `base` style groups) and the component's custom styling hooks freely in the same string. Omit the parameter entirely when no styling is requested.

## Components Without Styles

Not every component accepts `inlineStyle`. The `get_component_styles` result is the authority:

-   If it returns styles, the component accepts `inlineStyle`.
-   If it answers that styles are not documented for this component (or returns nothing), the component has **no** `inlineStyle` parameter — never add one. Inform the user that this component cannot be styled.

## Error Handling

A "styles are not documented for this component" response is a valid answer (see **Components Without Styles**), not a failure. If `get_component_styles` actually fails:

-   Retry once.
-   If it still fails, inform the user and ask whether to continue without component styling.

## Format of Styling Hook Names

Styling hooks are CSS variables that you use to update specific properties in a component's styling.
By convention, styling hooks `name` follow this format: `namespace-component-property-modifier`

**Conditional styling hooks**: Some styling hooks can be used only if a condition is met (`"when": { condition }`).

**Dynamic names**: Some styling hooks contain a dynamic variable that needs to be replaced by the component value.
For example, `--avonni-alert-{!variant}-color-background` where the component `variant` is `"error"` becomes `--avonni-alert-error-color-background`.

## Token Preference (Mandatory)

Always prefer design tokens over raw values. Raw values (e.g., `16px`) are only acceptable when a token does not match the required style.
Use the fallback value that corresponds to the token's intended value so the style degrades gracefully if the token is unavailable.

-   Correct: `var(--lwc-spacingMedium, 1rem)`
-   Avoid: `16px`

Call `get_style_tokens` with `toolset: "flow"` once per styling session to retrieve available token categories and their values. Pass the relevant `categories` to narrow down the result.

## Good Practices

Add spacing between sibling components (e.g. `margin-top: var(--lwc-spacingMedium, 1rem);`) so they are never visually flush against each other.

## Validation Requirements (Mandatory)

The output is an inline style CSS string of `<property>: <value>;` pairs.
Before producing final XML, verify:

-   Every CSS property or styling hook comes from the MCP response.
-   Every token used exists in the `get_style_tokens` response.

If any check fails, fix it before output.

### Unknown or Ambiguous Request

-   Never generate a CSS property or a styling hook that is not explicitly defined in the documentation, even if the name seems plausible or close to an existing one.
