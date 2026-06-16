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

## The Component Tree

`contentBody.component` is the root node. Every node is either a **component** or a **region**, nested alternately:

-   A **component** node (`"type": "component"`) has a `definition` (e.g. `avxp:xpcList`, `community_layout:section`), an `id`, optional `attributes`, and — if it has slots — `children` that are **region** nodes.
-   A **region** node (`"type": "region"`) has an `id`, a `name`, a `title`, and `children` that are **component** nodes. A region is a slot of its parent component (or a column of a layout section).

So the nesting always alternates: component → regions → components → regions …

## Find the Avonni Components

Walk the tree and collect every component node whose `definition` starts with `avxp:` — these are the Avonni components. For each, note:

-   the component label (resolve the name after `avxp:` via `get_component_docs` if needed),
-   its `id`,
-   its parent region's `name` (the slot it sits in),
-   the key configured `attributes`.

Non-Avonni nodes (`community_layout:section`, `community_layout:sldsFlexibleLayout`, `dxp_base:textBlock`, `community_builder:*`, etc.) are layout/standard components — note them as structure, but do not modify them unless the request is specifically about them.

## Present to the User

On the Update Path, present the current Avonni components in reading order (top to bottom, by slot), using their labels and a short summary of what each is configured to do. Then ask what to change.

## Choosing the Insertion Region (Add Path)

To add a component you must pick the **region** whose `children` array will receive the new node:

-   To place a component directly on the page, use a layout column region (a `community_layout:section`'s column region, e.g. `name: "col1"`) inside the main content region.
-   To place a component inside an Avonni container, use the matching slot region of that container (e.g. an Accordion's `content` region, an Accordion Section's `title`/`actions`/`content` regions). The region `name` must equal one of the parent component's documented slot names (`get_component_docs` → `slots`).
-   If the intended region does not exist yet (e.g. an Accordion Section has no `actions` region), you may add the missing region node — see `references/build-view-content.md`.

Never invent a layout: reuse the existing sections/columns of the page unless the user asks to add a component into a specific container.
