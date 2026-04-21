# Component Planning Instructions

Your goal is to create a plan describing the Dynamic Component that will be built. The plan will be output to a non-technical user.

## 1. Identify what features should be mentioned in the plan

-   You can only use components for which you have already called `get_component_docs`.
-   Use the components documentation to identify what features are available for each component.
-   Only include features that clearly support the user's requirements. Do not mention properties that are not relevant to the requested functionality.
-   Your plan CANNOT include features that are not available in the components documentation.

## 2. Identify what objects are used in the plan

-   If components display records through a query, you need to identify which object(s) they use and what their fields are.
-   To retrieve objects and field documentation, read `get-object-documentation.md`.
-   Your plan CANNOT include objects or fields that are not available in the objects documentation.
-   If the components only display static data, do not retrieve the objects documentation.

## 3. Create the plan

-   The plan should be understandable by a non-technical user.
-   Describe the components features in natural language. Do not list all of their properties.
-   Summarize the properties values in human-readable language. For example, say "The component will be filterable by Account Name and Billing City. The filters will be placed inside a panel", instead of saying "Filters will be equal to Name and BillingCity. Filter Menu Attributes type will be set to panel."
-   Do not mention aggregate queries functions directly (SUM, COUNT, etc.). Instead explain what their result will be.
-   When multiple components are used, organize the plan using a hierarchical structure that reflects the component tree using bullet nesting.

### Unknown or Ambiguous request

-   The plan must make decisions. If the requirements are unclear about object fields or component features, you should pick ones.
-   If a required feature cannot be implemented using the available components and objects, do not invent. Instead, use the closest available configuration.

### Error handling

If you encountered problems when generating the plan, you should mention it at the end of the plan. For example, if a user asked for a feature or a component that does not exist, you should mention it and explain how you adapted the plan accordingly.
