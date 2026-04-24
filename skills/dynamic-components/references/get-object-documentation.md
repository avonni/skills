# Get Objects and Fields Documentation

## Execution Workflow

1. Get the list of available objects in the current Salesforce org.
2. Determine what objects fit the user requirements.
    - Only consider objects that are listed in the objects list.
    - Be decisive. If you hesitate between two objects, pick one.
3. If you need to use object fields, get the list of available fields for each object you pick.

## Get Objects List

Run exactly the command `sf sobject list` to get the list of all the available objects.
If the command succeeds, cache the result and use it directly. Do not call this command again.

## Get Fields List

For each object you pick, run the following command to get a list of its fields, replacing `<ObjectName>` with the object API name. For example, for Account: `sf sobject describe --sobject Account --json 2>/dev/null | node -e "JSON.parse(require('fs').readFileSync(0,'utf8')).result.fields.forEach(f=>console.log(f.name,'-',f.type, f.referenceTo.length && f.type === 'reference' ? 'to: ' + f.referenceTo.join(', ') : ''));"`

If the command succeeds, cache the result and use it directly. Do not call the same object again.

## Command Syntax (Mandatory)

When running a command:

-   Do not add pipes (|, | head, | tail, | grep, etc.).
-   Do not add redirections (2>/dev/null, > file, etc.).
-   Do not add extra flags unless you explicitly document them.
-   Do not truncate the list as it can hide valid API names.

## Error handling

-   If the commands are failing because the `sf` command does not exist, stop and ask the user to install the Salesforce CLI.
-   If the command to retrieve fields fails, run this command once: `sf sobject describe --sobject Account`.
-   If the same command fails twice, inform the user and ask whether to continue without objects and fields.
