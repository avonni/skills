# Styling

Experience components are styled through CSS custom properties (styling hooks). `get_component_styles` with `toolset: "experience"` returns, for a component:

-   `stylingHooks` — the CSS custom properties you can set (e.g. `--avdxp-button-color-background`, `--avdxp-button-radius-border`), each optionally listing the `tokens` (design-token values) that fit it;
-   `tokens` — the resolved design tokens (`value` / `fallbackValue`) for those categories.

Only use hooks returned by `get_component_styles`. Never invent a hook name.

## How styling is applied in a site

In a Digital Experience site, per-component style choices are stored on the component's **`inlineStyle`** attribute as a serialized configuration produced by the site's style editor. The MCP documents *which* hooks exist, but not the editor's serialized `inlineStyle` shape.

Therefore:

-   **Prefer site-level theming.** The cleanest way to style is at the theme/branding level using the documented hook names — these cascade to every instance. Tell the user which hooks (in natural-language labels) control the look they want.
-   **Only set `inlineStyle` directly** when the user asks for a one-off override **and** you can mirror the exact serialized shape from an existing component on the same site. Copy that shape, substitute values, and keep it as a compact JSON string. If you cannot determine the shape, do not guess — explain the limitation and recommend theming with the hook names instead.

## Tokens

When suggesting values, prefer the design tokens returned for a hook (the `tokens` list) over hardcoded values, so the styling follows the site's branding.
