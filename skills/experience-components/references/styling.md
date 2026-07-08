# Styling

Experience components are styled through CSS custom properties (styling hooks). `get_component_styles` with `toolset: "experience"` returns the `stylingHooks` for a component — the CSS custom properties you can set (e.g. `--avdxp-button-color-background`), each optionally listing the `tokens` categorie(s) that fit it.

Use `get_style_tokens` with `toolset: "experience"` to retrieve the resolved design tokens (`value` / `fallbackValue`) for those categories.

Only use hooks returned by `get_component_styles` and tokens returned by `get_style_tokens`. Never invent a hook or token name.

## Attribute Structure

Styling is saved in the component's **`inlineStyle`** attribute as an inline CSS string.

**Example:**

```json
{
    "inlineStyle": "--avdxp-button-color-background: var(--dxp-g-info-1);--avdxp-button-sizing-border: 2px;--avdxp-button-styling-border:solid;"
}
```

## Tokens

When suggesting values, prefer design tokens over hardcoded values, so the styling follows the site's branding.
`get_style_tokens` should be called once per styling session to retrieve available token categories and their values. Pass the relevant `categories` found in the to narrow down the result.
