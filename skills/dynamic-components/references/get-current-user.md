# Get the Current User Full Name

1. Run the command `sf org display user --json | jq -r '.result.username'`.
    - Let the user know you need their full name to save it as the creator of the component.
    - The command returns the current user's username.
2. Run the command `sf data query --query "SELECT FirstName, LastName, Username FROM User WHERE Username = '<username>'"`.
    - Replace `<username>` with the result from the previous command.
    - Save the first name and last name as the current user full name.

## Error Handling

-   If the commands are failing because the `sf` command does not exist, stop and ask the user to install the Salesforce CLI.
-   If the command used to get the username fails, run `sf org display user` without adding anything to the command. Extract the username from the result.
-   If the same command fails twice, ignore this step and continue without a user full name.
