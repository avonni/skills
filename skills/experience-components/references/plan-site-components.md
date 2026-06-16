# Component Planning Instructions

Your goal is to create a plan describing the Avonni components that will be added to or changed on a Digital Experience site view. The plan will be output to a non-technical user.

## Execution Workflow

1. Call `list_components` with `toolset: "experience"` using the MCP.
2. Determine what components fit the user request.
3. Call `get_component_docs` with `toolset: "experience"` once per selected component.
    - Pass the component name as a single `name` string input.
    - Never batch multiple components into one call.
    - Process each response directly — no shell commands are needed to parse the result.

## Pick Components

-   If the user request is unclear on what component to use, ask questions.
-   Do not ask questions on features at this stage.
-   Only consider components listed in `list_components`. Never make up components.
-   Be decisive. If you hesitate between two components, pick one.
-   Before selecting components:
    1. Identify the section's purpose (display records, group content, call to action, navigation, etc.).
    2. Determine the main functional blocks required.
    3. Select the components that best implement those blocks.
-   Some components are **containers** with named slots (e.g. an Accordion holds Accordion Sections; an Accordion Section has title, actions, and content slots). When a component's docs include a `slots` array, plan which child components go in which slot.

## Identify What Features Should Be Mentioned in the Plan

-   You can only use components for which you have called `get_component_docs`.
-   Use the components documentation to identify what features are available for each component.
-   Only include features that clearly support the user's requirements. Do not mention properties that are not relevant.
-   Your plan CANNOT include features that are not available in the components documentation.

## Identify Interactions

-   If the user needs components to react to events (button clicks, item clicks → navigation), check the available interactions.
-   Call `list_interactions` with `toolset: "experience"` to get the list of available interactions.
-   Read `references/interactions.md` for how interactions are configured. Properties typed `interaction[]` (for example a button's `evtClick`, or a list item mapping's `evtclick`) hold these interactions.

## Identify Styles

-   If the user needs to style components, check the available styles.
-   Call `get_component_styles` with `toolset: "experience"` once per component that needs styling:
    -   Pass the component name as a single `name` string input.
    -   Never batch multiple components into one call.
-   Read `references/styling.md`.

## Identify the Target Site and View

-   Determine which site and which view (page) the components belong to. The target view is `…/sfdc_cms__view/<view>/content.json`.
-   If the user asked to update components, identify which existing Avonni components are affected.
-   Never plan to create a site, route, theme, branding set, or view. If the target page does not exist, stop and tell the user to create it first with their usual Digital Experience tooling.

## Identify What Objects Are Used

-   If components reference Salesforce objects or fields (a query data source, record mappings, navigation to a record/object), identify which object(s) they use and what their fields are.
-   To retrieve object and field documentation, read `references/get-object-documentation.md`.
-   Your plan CANNOT include objects or fields not available in the objects documentation.
-   If the components only display static data, do not retrieve the objects documentation.

## Create the Plan

-   The plan should be understandable by a non-technical user.
-   Describe the components' features in natural language. Do not list all of their properties.
-   Summarize property values in human-readable language. For example, say "The list shows accounts by name and clicking one opens its record page", not "items.querySObjectApiName = Account and querySObjectMapping.evtclick = NavigationMixinNavigate".
-   When multiple components are used, list them in the order they will appear on the page, and name the slot/region each goes into.

## Tool Usage

-   You can never call `get_component_docs` before calling `list_components`.
-   Never assume the name of a component, always check the `list_components` output.
-   Only retrieve docs for components you actually plan to use.

## Unknown or Ambiguous Request

-   The plan must make decisions. If the requirements are unclear about component features, pick ones.
-   If a required feature cannot be implemented using the available components, do not invent. Use the closest available configuration and mention the adaptation in the plan.

## Error Handling

If you encountered problems when generating the plan, mention it at the end of the plan. For example, if a user asked for a component or feature that does not exist, mention it and explain how you adapted the plan.
If `list_interactions` fails, inform the user and continue without using interactions.
