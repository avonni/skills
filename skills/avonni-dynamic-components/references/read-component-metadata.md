# Read Component Metadata File

Your goal is to read an existing Dynamic Component metadata file and present its current structure to the user.

## Execution Workflow

1. Ask the user for the path to the existing `.md-meta.xml` file they want to update.
2. Run the script to extract the component JSON to stdout:

```bash
node <skill_base_directory>/scripts/read-component.mjs <path-to.md-meta.xml>
```

3. The JSON printed on stdout contains a `_passthrough` field alongside the structured component data (`apiName`, `value`, `queries`, `resources`, etc.). Save the entire `_passthrough` object in memory — you will need to inject it back into the component JSON before saving in a later step.
4. Present the current component structure to the user as a natural-language plan.

## Present the Current Component Plan

Present the extracted structure to the user using the same natural-language plan format defined in `plan-component.md`:

-   Describe components, their features, and configured properties in plain language.
-   Do not show raw JSON to the user.
-   Use component labels, not API names.

This gives the user a clear picture of what exists before they describe what they want to change.

## Error Handling

-   If the script fails, inform the user of the error message and ask them to verify the file path and format.
-   Do not attempt to parse the XML manually as a fallback.
