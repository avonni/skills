# Styling

Experience components are styled through CSS custom properties (styling hooks). `get_component_styles` with `toolset: "experience"` returns, for a component:

-   `stylingHooks` — the CSS custom properties you can set (e.g. `--avdxp-button-color-background`), each optionally listing the `tokens` (design-token values) that fit it;
-   `tokens` — the resolved design tokens (`value` / `fallbackValue`) for those categories.

Only use hooks returned by `get_component_styles`. Never invent a hook name.

## Attribute Structure

Styling is saved in the component's **`inlineStyle`** attribute as an inline CSS string.

**Example:**

```json
{
    "inlineStyle": "--avdxp-button-color-background: var(--dxp-g-info-1);--avdxp-button-sizing-border: 2px;--avdxp-button-styling-border:solid;"
}
```

## Tokens

When suggesting values, prefer the design tokens returned for a hook (the `tokens` list) over hardcoded values, so the styling follows the site's branding.
