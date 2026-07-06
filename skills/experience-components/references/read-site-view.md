# Reading a Site View

A Digital Experience site stores each page as a **view**:

```
force-app/main/default/digitalExperiences/site/<site>/sfdc_cms__view/<view>/content.json
```

`content.json` holds the page's component tree under `contentBody.component`. This reference explains how to find the file and walk the tree.

## Locate the View

1. If the user gave a path to a `content.json`, use it.
2. Otherwise, find the site under `…/digitalExperiences/site/`, then the view under that site's `sfdc_cms__view/`. The view folder name and the `urlName`/`viewType` inside `content.json` identify the page (e.g. `home`).
3. If you cannot identify the view, ask the user which site and page they mean. Never create the view.

Once the file is located, detect the package namespace with `node <skill_base_directory>/scripts/namespace.mjs <path-to-content.json>` — Avonni components are prefixed with `avxp:` or `avcmpbuilder:` depending on the installed package. The result is `<namespace>` everywhere below and in the other references.

## The Component Tree

`contentBody.component` is the root node. Every node is either a **component** or a **region**, nested alternately:

-   A **component** node (`"type": "component"`) has a `definition` (e.g. `avxp:xpcList`, `avcmpbuilder:xpcList`, `community_layout:section`), an `id`, optional `attributes`, and — if it has slots — `children` that are **region** nodes.
-   A **region** node (`"type": "region"`) has an `id`, a `name`, a `title`, and `children` that are **component** nodes. A region is a slot of its parent component (or a column of a layout section).

So the nesting always alternates: component → regions → components → regions …

## Find the Avonni Components

Walk the tree and collect every component node whose `definition` starts with `<namespace>:` — these are the Avonni components. For each, note:

-   the component name (what is after `<namespace>:` and starts with `xpc`; resolve it via `get_component_docs` if needed),
-   its `id`,
-   its parent region's `name` (the slot it sits in),
-   the key configured `attributes`.

Non-Avonni nodes (`community_layout:section`, `community_layout:sldsFlexibleLayout`, `dxp_base:textBlock`, `community_builder:*`, etc.) are layout/standard components — note them as structure, but do not modify them.
