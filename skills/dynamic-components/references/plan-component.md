# Component Planning Instructions

Your goal is to create a plan describing the Dynamic Component that will be built. The plan will be output to a non-technical user.

## Execution Workflow

1. Call `list_components` with `package: "dynamic"` using the MCP.
2. Determine what components fit the user request.
3. Call `get_component_docs` with `package: "dynamic"` once per selected component.
    - Pass the component name as a single `name` string input.
    - Never batch multiple components into one call.
    - Process each response directly — no shell commands are needed to parse the result.

## Determine target page context

Before picking components, determine whether the component will be placed on a **record page** (e.g., an Account or Opportunity page):

-   If the user's request clearly implies a record page (e.g., "on the Account page", "show the current record's fields"), note the object API name (e.g., `Account`, `Opportunity`).
-   If it is unclear, ask the user before proceeding.
-   If the component is not for a record page, no object API name is needed.

The object API name will be included in the plan and passed through to the build and save steps.

## Pick components

-   If the user request is unclear on what component to use, ask questions.
-   Do not ask questions on features at this stage.
-   Only consider components that are listed in `list_components`. Never make up components.
-   Be decisive. If you hesitate between two components, pick one.
-   Before selecting components:
    1. Identify the user interface type (dashboard, form, record page, gallery, etc.).
    2. Determine the main functional blocks required.
    3. Select the components that best implement those blocks.

## Identify what features should be mentioned in the plan

-   You can only use components for which you have called `get_component_docs`.
-   Use the components documentation to identify what features are available for each component.
-   Only include features that clearly support the user's requirements. Do not mention properties that are not relevant to the requested functionality.
-   Your plan CANNOT include features that are not available in the components documentation.

## Identify existing interactions

-   If the user needs to interact with the components, you have to check the available interactions.
-   Call `list_interactions` to get the list of available interactions.

## Identify existing styles

-   If the user needs to style the components, you have to check the available styles.
-   Call `get_component_styles` with `package: "dynamic"` once per component that needs styling:
    -   Pass the component name as a single `name` string input.
    -   Never batch multiple components into one call.

## Identify what objects are used in the plan

-   If components display records through a query, you need to identify which object(s) they use and what their fields are.
-   To retrieve objects and field documentation, read `get-object-documentation.md`.
-   Your plan CANNOT include objects or fields that are not available in the objects documentation.
-   If the components only display static data, do not retrieve the objects documentation.

## Create the plan

-   The plan should be understandable by a non-technical user.
-   Describe the components features in natural language. Do not list all of their properties.
-   Summarize the properties values in human-readable language. For example, say "The component will be filterable by Account Name and Billing City. The filters will be placed inside a panel", instead of saying "Filters will be equal to Name and BillingCity. Filter Menu Attributes type will be set to panel."
-   Do not mention aggregate queries functions directly (SUM, COUNT, etc.). Instead explain what their result will be.
-   When multiple components are used, organize the plan using a hierarchical structure that reflects the component tree using bullet nesting.

## Tool usage

-   You can never call `get_component_docs` before calling `list_components`.
-   Never assume the name of a component, always check the `list_components` output.
-   Only retrieve docs for components you actually plan to use.

## Unknown or ambiguous request

-   The plan must make decisions. If the requirements are unclear about object fields or component features, you should pick ones.
-   If a required feature cannot be implemented using the available components and objects, do not invent. Instead, use the closest available configuration.

## Error handling

If you encountered problems when generating the plan, you should mention it at the end of the plan. For example, if a user asked for a feature or a component that does not exist, you should mention it and explain how you adapted the plan accordingly.
If `list_interactions` fails, inform the user and continue without using interactions.
