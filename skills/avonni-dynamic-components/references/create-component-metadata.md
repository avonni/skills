# Save a Component Version

Your goal is to save a Dynamic Component as a metadata file. Depending on the user's choice, this either creates a new version or updates the current one in place.

## Step 1 — Query Existing Versions

Run the following script, replacing `<apiName>` with the component's `apiName`:

```bash
node <skill_base_directory>/scripts/query-versions.mjs --api-name <apiName>
```

The script outputs a JSON object:

```json
{
    "nextVersion": 3,
    "currentVersion": 2,
    "lastModifiedDeveloperName": "MyComponent_2"
}
```

From the result:

-   Use `nextVersion` as the candidate new version number.
-   Use `currentVersion` as the candidate overwrite version number (may be `null`).
-   Save `lastModifiedDeveloperName` for use in Step 4 (may be `null`).

### Error Handling

-   If the script fails, retry once.
-   If it still fails, inform the user and ask whether to continue. If continuing, use version `1` and skip Steps 2 and 4.
-   If `nextVersion` is `1` and `currentVersion` is `null`, this is a first-time save — skip Step 2.

## Step 2 — Choose Versioning Strategy

If Step 1 returned existing records, stop and present the following options to the user. Use this exact format so they can reply with just a number:

> How do you want to save this component?
>
> 1. Create a new version (version `<nextVersion>`) — default
> 2. Update the current version (version `<currentVersion>`) directly

-   If the user replies `1`, does not answer, or their answer is ambiguous: use `<nextVersion>` in Step 3, and run Step 4.
-   If the user replies `2`, or their answer clearly expresses intent to overwrite/update the current version: use `<currentVersion>` in Step 3, and skip Step 4.

If Step 1 returned no records (first-time save), use version `1` and skip Step 4 — do not ask the user.

## Step 3 — Save the Version File

Before saving, check whether you are on the **Update Path** (i.e., you read an existing metadata file earlier in this session). If so, the read script produced a `_passthrough` object that must be merged back into the component JSON. Add it as a top-level `"_passthrough"` key so that fields not managed by the build process (status, style classes, interactions, audit timestamps, etc.) are preserved in the output file.

Pipe the component JSON (generated in the previous skill step) into the save script. Do not write the JSON to a file first. The save script runs validation internally before writing the file.

The save script is the **only** allowed way to produce the `.md-meta.xml` file. Never create or edit that file with any other tool (Write, Edit, shell redirection, etc.) — a hand-written file is missing the auto-generated `id` fields and audit fields, and will not work. This applies even if the script command fails or is denied: fix the problem and re-run the script, or stop and report the error to the user. Never fall back to writing the file yourself.

```bash
node <skill_base_directory>/scripts/create-component.mjs - --version <version> [--edit] [--prev-developer-name <lastModifiedDeveloperName>] <<'EOF'
<component JSON here, with "_passthrough" included if on the Update Path>
EOF
```

-   Use `<<'EOF'` (quoted) so the shell does not interpolate `$` or backticks inside the JSON.
-   Replace `<version>` with the version number determined in Step 2.
-   Pass `--edit` **only** when the user chose option 2 (updating the current version in place). Do not pass it for new versions or new components.
-   Pass `--prev-developer-name` with the `lastModifiedDeveloperName` from Step 1 **only** when creating a new version (user chose option 1) and `lastModifiedDeveloperName` is not `null`. Do not pass it on `--edit` or on a first-time save.
-   On the **Create Path** (brand-new component), omit `_passthrough` entirely.
-   The save script auto-generates all `id` fields (UUID v4), validates the structure, and automatically clears the `IsLastModified__c` flag on the previous version when `--prev-developer-name` is provided. If validation fails, it exits with a non-zero code and prints errors to stderr — the file will not be written.

### Handling Validation Errors

If the save script exits with validation errors:

-   Read each error message carefully.
-   Fix the component JSON.
-   Re-run the command.

If the save script fails for any other reason (command denied, Node error, etc.), stop and report the error to the user. Do not write the metadata file by hand.

## Step 4 — Remove "last modified" Flag From the Previous Version

If you saved a `DeveloperName` in Step 1, run:

```bash
node <skill_base_directory>/scripts/remove-last-modified-flag.mjs <DeveloperName>
```

Replace `<DeveloperName>` with the saved value. The script finds the file locally under `./force-app`, retrieves it from Salesforce automatically if it is missing, and sets `avxp__IsLastModified__c` to false.

### Error Handling

-   If the script fails, inform the user of the error message and the file that was expected.
-   Never skip this step silently.
