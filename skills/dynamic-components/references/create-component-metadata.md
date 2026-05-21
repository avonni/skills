# Save a Component Version

Your goal is to save a Dynamic Component as a metadata file. Depending on the user's choice, this either creates a new version or updates the current one in place.

## Step 1 — Query Existing Versions

Run the following Salesforce query, replacing `<apiName>` with the component's `apiName`:

```bash
sf data query --query "SELECT DeveloperName, avxp__VersionNumber__c, avxp__IsLastModified__c FROM avxp__AvonniDynamicComponent__mdt WHERE avxp__DynamicComponentName__c = '<apiName>'"
```

From the results:

-   Find the highest `avxp__VersionNumber__c` value. The new version number is that value + 1 as a whole number (e.g. if the max is `2.0`, the next version is `3`).
-   Save the `DeveloperName` of the record where `avxp__IsLastModified__c` is `true`, if any exists.

### Error handling

-   If the query fails, retry once.
-   If it still fails, inform the user and ask whether to continue. If continuing, use version `1` and skip Step 3.
-   If no records are returned, use version `1` and skip Step 3.

## Step 2 — Choose Versioning Strategy

If Step 1 returned existing records, stop and present the following options to the user. Use this exact format so they can reply with just a number:

> How do you want to save this component?
> 1. Create a new version (version `<nextVersion>`) — default
> 2. Update the current version (version `<currentVersion>`) directly

-   If the user replies `1`, does not answer, or their answer is ambiguous: use `<nextVersion>` in Step 3, and run Step 4.
-   If the user replies `2`, or their answer clearly expresses intent to overwrite/update the current version: use `<currentVersion>` in Step 3, and skip Step 4.

If Step 1 returned no records (first-time save), use version `1` and skip Step 4 — do not ask the user.

## Step 3 — Save the Version File

Before saving, check whether you are on the **Update Path** (i.e., you read an existing metadata file earlier in this session). If so, the read script produced a `_passthrough` object that must be merged back into the component JSON. Add it as a top-level `"_passthrough"` key so that fields not managed by the build process (status, style classes, interactions, audit timestamps, etc.) are preserved in the output file.

Pipe the component JSON directly into the script via stdin using a heredoc. Do not write the JSON to a file first.

```bash
node <skill_base_directory>/scripts/create-component.mjs - --version <version> <<'EOF'
<component JSON here, with "_passthrough" included if on the Update Path>
EOF
```

-   The `-` positional argument tells the script to read JSON from stdin.
-   Use `<<'EOF'` (quoted) so the shell does not interpolate `$` or backticks inside the JSON.
-   Replace `<version>` with the version number determined in Step 2.
-   On the **Create Path** (brand-new component), omit `_passthrough` entirely.

## Step 4 — Remove "last modified" Flag From the Previous Version

If you saved a `DeveloperName` in Step 1, run:

```bash
node <skill_base_directory>/scripts/remove-last-modified-flag.mjs <DeveloperName>
```

Replace `<DeveloperName>` with the saved value. The script finds the file locally under `./force-app`, retrieves it from Salesforce automatically if it is missing, and sets `avxp__IsLastModified__c` to false.

### Error handling

-   If the script fails, inform the user of the error message and the file that was expected.
-   Never skip this step silently.
