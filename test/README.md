## Local Testing

To run the integration tests locally make sure to set the following environment variables and run `yarn coverage:local`.
And make sure you set following environment variables.

```
DB_HOST=localhost
PORT=8088
SENTRY_ENABLED=false
IRONPLANS_TOKEN=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

To run a specific test file only, simply pass it as a parameter `yarn coverage:local test/modules/aws-cloudwatch-integration.ts`

## Integration tests CI/CD

### Common integration

Common tests are inside `test/common/` directory. This tests run sequentially and they use the `Testing` account. To add a new test just create the file inside the common directory and it will run automatically.

### Modules

Modules tests are inside `test/modules/` directory. Modules tests run in parallel with each other but sequentially within each module file and each use a specific account per module to avoid rate limits per account. To add a new test:

- Create the test file inside `test/modules`. The current pattern to name the file is `aws-<aws-service>-integration`.
- Create a new AWS account under the `iasql` organization:
  
  - Add account following the same pattern for the name `aws-<aws-service>-integration` and the email `dev+aws-<aws-service>-integration`.
  - Move the account to the Integration testing organization Unit. This way all the resources created by these accounts will be isolated and unrrelated to the other environments.
  - Reset password for the account
  - Generate account credentials

- Save account credentials as Github actions secret. The name of the secrets should follow the pattern:
  
  - `AWS_ACCESS_KEY_ID_<name of the test file in uppercase and replacing - with _>`
  - `AWS_SECRET_ACCESS_KEY_<name of the test file in uppercase and replacing - with _>`

- Run the tests. It will parallelize the test file and use the new credentials automatically.