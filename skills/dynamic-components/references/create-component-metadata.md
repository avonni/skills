# Save a Component Version

Your goal is to save a Dynamic Component as a metadata file. Depending on the user's choice, this either creates a new version or updates the current one in place.

## Step 1 — Get the Current User Full Name

Read `references/get-current-user.md` and follow its instructions.

## Step 2 — Query Existing Versions

Run the following Salesforce query, replacing `<apiName>` with the component's `apiName`:

```bash
sf data query --query "SELECT DeveloperName, avxp__VersionNumber__c, avxp__IsLastModified__c FROM avxp__AvonniDynamicComponent__mdt WHERE avxp__DynamicComponentName__c = '<apiName>'"
```

From the results:

-   Find the highest `avxp__VersionNumber__c` value. The new version number is that value + 1 as a whole number (e.g. if the max is `2.0`, the next version is `3`).
-   Save the `DeveloperName` of the record where `avxp__IsLastModified__c` is `true`, if any exists.

### Error handling

-   If the query fails, retry once.
-   If it still fails, inform the user and ask whether to continue. If continuing, use version `1` and skip Step 4.
-   If no records are returned, use version `1` and skip Step 4.

## Step 3 — Choose Versioning Strategy

If Step 2 returned existing records, stop and present the following options to the user. Use this exact format so they can reply with just a number:

> How do you want to save this component?
> 1. Create a new version (version `<nextVersion>`) — default
> 2. Update the current version (version `<currentVersion>`) directly

-   If the user replies `1`, does not answer, or their answer is ambiguous: use `<nextVersion>` in Step 4, and run Step 5.
-   If the user replies `2`, or their answer clearly expresses intent to overwrite/update the current version: use `<currentVersion>` in Step 4, and skip Step 5.

If Step 2 returned no records (first-time save), use version `1` and skip Step 5 — do not ask the user.

## Step 4 — Save the Version File

Run the script with the `--version` flag:

```bash
node <skill_base_directory>/scripts/create-component.mjs <path to component.json> --version <version> --user "<full user name>"
```

-   Replace `<version>` with the version number determined in Step 3.
-   If you failed to get the current user name, omit the `--user` parameter.

## Step 5 — Remove "last modified" Flag From the Previous Version

If you saved a `DeveloperName` in Step 2, run:

```bash
node <skill_base_directory>/scripts/remove-last-modified-flag.mjs <DeveloperName>
```

Replace `<DeveloperName>` with the saved value. The script finds the file locally under `./force-app`, retrieves it from Salesforce automatically if it is missing, and sets `avxp__IsLastModified__c` to false.

### Error handling

-   If the script fails, inform the user of the error message and the file that was expected.
-   Never skip this step silently.
