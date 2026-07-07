# Component Planning Instructions

Your goal is to create a plan describing the Avonni Flow Screen Components that will be built or changed. The plan will be output to a non-technical user.

## Execution Workflow

1. Call `list_components` with `toolset: "flow"` using the MCP.
2. Determine what components fit the user request.
3. Call `get_component_docs` with `toolset: "flow"` once per selected component.
    - Pass the component name as a single `name` string input.
    - Never batch multiple components into one call.
    - Process each response directly — no shell commands are needed to parse the result.

## Pick Components

-   If the user request is unclear on what component to use, ask questions.
-   Do not ask questions on features at this stage.
-   Only consider components that are listed in `list_components`. Never make up components.
-   Be decisive. If you hesitate between two components, pick one.
-   Before selecting components:
    1. Identify the screen's purpose (data entry, record display, selection, confirmation, etc.).
    2. Determine the main functional blocks required.
    3. Select the components that best implement those blocks.

## Identify What Features Should Be Mentioned in the Plan

-   You can only use components for which you have called `get_component_docs`.
-   Use the components documentation to identify what features are available for each component.
-   Only include features that clearly support the user's requirements. Do not mention properties that are not relevant to the requested functionality.
-   Your plan CANNOT include features that are not available in the components documentation.

## Identify the Correct Data Source Type

Valid only for components that include a `dataSources` object in their documentation.
Before planning the data source, determine which type fits the request:

1. **Picklist data source** — use when the user wants to display the possible options/values of a Salesforce picklist field (e.g. "show the Industry options", "list the Stage values"). A component supports this mode if it has a `picklistValues` key (it may be an empty array — that is still valid).
2. **Variable data source** — use when items come from a flow resource: a Get Records element, a record collection variable, or another component's output.
3. **Query data source** — use when the component should load Salesforce records itself, directly from the database.
4. **Static data source** — use only when items are fixed, hardcoded values unrelated to any Salesforce object or field.

Read `references/data-sources.md` for the details of each mode. Only plan modes that exist in the component's `dataSources` documentation.

## Identify Existing Interactions

-   If the user needs the components to react to events (clicks, saves, changes…), you have to check the available interactions.
-   Call `list_interactions` with `toolset: "flow"` to get the list of available interactions.

## Identify Existing Styles

-   If the user needs to style the components, you have to check the available styles.
-   Call `get_component_styles` with `toolset: "flow"` once per component that needs styling:
    -   Pass the component name as a single `name` string input.
    -   Never batch multiple components into one call.

## Identify the Flow Context

-   **Create Path:** decide the flow label and the screen label from the user request. If the user gave no name, propose one — do not ask.
-   **Update Path:** identify which screen(s) and which existing fields are affected. When adding components, pick the target screen: if the flow has one screen, use it; if it has several, pick the one matching the request and name it in the plan — ask only when the request gives no hint. Never create a screen — if no suitable screen exists, stop and tell the user to add one with their usual flow tooling first.

## Identify What Objects Are Used in the Plan

-   If components reference Salesforce objects or fields (query, variables, or picklist data sources, query filters and ordering, record mappings, picklist fields), you need to identify which object(s) they use and what their fields are.
-   To retrieve objects and field documentation, read `get-object-documentation.md`.
-   Your plan CANNOT include objects or fields that are not available in the objects documentation.
-   If the components only display static data, do not retrieve the objects documentation.

## Create the Plan

-   The plan should be understandable by a non-technical user.
-   Describe the components features in natural language. Do not list all of their properties.
-   Summarize the properties values in human-readable language. For example, say "The table will show the account's name, industry and rating, and rows will be editable", instead of saying "columns will be set to Name, Industry, Rating and allColumnsEditable will be true."
-   When multiple components are used, list them in the order they will appear on the screen.
-   On the Update Path, structure the plan as: components added, components changed, components removed.

## Tool Usage

-   You can never call `get_component_docs` before calling `list_components`.
-   Never assume the name of a component, always check the `list_components` output.
-   Only retrieve docs for components you actually plan to use.

## Unknown or Ambiguous Request

-   The plan must make decisions. If the requirements are unclear about component features, you should pick ones.
-   If a required feature cannot be implemented using the available components, do not invent. Instead, use the closest available configuration and mention the adaptation in the plan.

## Error Handling

If you encountered problems when generating the plan, you should mention it at the end of the plan. For example, if a user asked for a feature or a component that does not exist, you should mention it and explain how you adapted the plan accordingly.
If `list_interactions` fails, inform the user and continue without using interactions.
