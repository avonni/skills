# Reading an Existing Flow

Your goal is to parse an existing `.flow-meta.xml` file, identify the Avonni components it contains, and present them to a non-technical user.

## Execution Workflow

1. Read the flow file the user pointed to. If no path was given, search the project for `*.flow-meta.xml` files and match them against the flow the user described (label, API name, or the components it should contain — a flow with no Avonni component yet is a valid target). If several match, ask the user which one to use.
2. Identify every Avonni component instance: a `<fields>` element with `<fieldType>ComponentInstance</fieldType>` and an `<extensionName>` starting with `avcmpbuilder:`.
3. Call `list_components` with `toolset: "flow"` and match each `extensionName` suffix to a component to get its label.
4. For each component instance found, identify:
    - its data source mode (`itemsTypeSelected`, or static when absent and a static entry parameter is present),
    - the Salesforce object(s) involved: read the `typeValue` of each `dataTypeMappings` block — but only when the data source binds records (query or variables mode; in static mode the values are placeholders). For a picklist data source, use `picklistFieldApiName` instead,
    - its interactions (`evt*` parameters — list the interaction `type` values),
    - whether it is styled (`inlineStyle`).
5. Note which screen (`<screens>` label) each component belongs to.

## Present the Components

Output a short summary per screen, understandable by a non-technical user:

-   Use component labels, not API names (e.g. "Data Table", not `datatable`).
-   Describe the configuration in natural language ("a table of Accounts loaded from the database, with editable rows"), not as a parameter dump.
-   Mention interactions by their label ("clicking a row opens the record page").
-   Mention non-Avonni screen fields only in one line ("the screen also contains 2 standard fields"), without detail.

## Flows Without Avonni Components

A flow with no Avonni component yet is a normal Update Path case — the user is adding their first one.

-   Confirm the flow is a screen flow (`<processType>Flow</processType>`) and has at least one `<screens>` element. If not, stop: Avonni components can only live on a screen of a screen flow. Tell the user to add a screen with their usual flow tooling first (creating screens and connectors is outside this skill's scope).
-   Instead of the component summary, present the flow's screens (label and number of fields of each) so the target screen can be chosen during planning.
-   Do not ask whether the user wants to add components when their request already says so — continue to the planning step.

## Rules

-   Do not modify the file at this stage.
-   Do not call `get_component_docs` yet — that happens in the planning step, and only for components the change affects.
-   If the file is not a valid flow (no `<Flow>` root), stop and report it.
