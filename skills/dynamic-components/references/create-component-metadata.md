# Create Component Custom Metadata File

Your goal is to create a Custom Metadata file for a Dynamic Component.

## Get the Current User Full Name

1. Run the command `sf org display user --json | jq -r '.result.username'`.
    - When running the command, let the user know you need its full name to save it as the creator of the component.
    - The command returns the current user username.
2. Run the command `sf data query --query "SELECT FirstName, LastName, Username FROM User WHERE Username = '<username>'"`.
    - Replace <username> with the previous command's result.
    - Save the first name and last name as the current user full name.

### Error handling

-   If the commands are failing because the `sf` command does not exist, stop and ask the user to install the Salesforce CLI.
-   If the command used to get the username fails, run `sf org display user` without adding anything to the command. Extract the username from the result.
-   If the same command fails twice, ignore this step and continue to the custom metadata generation.

## Create the Custom Metadata File

Run the script `scripts/create-component.mjs` using this format:

```bash
    node <skill_base_directory>/scripts/create-component.mjs <path to component.json> --user "<full user name>"
```

-   `component.json` is the file created in the previous step.
-   If you failed getting the current user name, do not include the `--user` parameter.
