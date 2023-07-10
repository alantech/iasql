# 000 - Postmortem for v0.0.19 Deployment Failure

## Level: Internal

## Author(s)

- David Ellis <david@iasql.com>

## Summary

The `v0.0.19` release could not be deployed despite the test suite succeeding. A combination of a new deployment mechanism and gaps in the test suite actually *prevented* a worse outage of deploying broken code, but feature development was significantly slowed trying to figure out what exactly broke. It turned out to be a mistake in the `iasql_upgrade` logic, made more difficult to figure out due to separate-but-unrelated bugs with the new `default_aws_region` postgres function. The new deployment mechanism exercises `iasql_upgrade` and therefore hit this bug and prevented rollout of the faulty release.

## Timeline

- **2022-09-05**: Release day for `v0.0.19`, rushing to get desired features out the door, but were unable to. Release was delayed rather than skip these features.
- **2022-09-07**: [Actual attempted release for `v0.0.19`](https://github.com/alantech/iasql-engine/tree/v0.0.19), tests are passing on the `main` branch, and manual testing locally did not uncover any issues. There *was* an error in the staging deploy earlier in the day, but it was assumed caused by other experiments. After the `staging` IaSQL database was cleaned up, further staging deploys were successful, so it was assumed that the `production` deployment would be the same. Instead the `production` deploy failed, and an investigation began.
- **2022-09-09**: [Actual root cause found and fixed, and new test written to verify no regressions occur](https://github.com/alantech/iasql-engine/pull/1241). A few bugs unrelated to the root cause in the `default_aws_region` function are also fixed in the process.
- **2022-09-12**: Release day for `v0.0.20`, but being extra cautious and it was also put on hold because of an error in the Prisma Example end-to-end test, and investigation into this occurs.
- **2022-09-13**: [Improved logging in the Prisma example deployment](https://github.com/alantech/iasql-engine/pull/1270), but cause of this issue not found.
- **2022-09-14**: [Root cause of Prisma end-to-end test found](https://github.com/alantech/iasql-engine/pull/1272): The test account was not properly cleaned. Adding a pre-clean script however, also broke things, and an issue in the `delete_all_records` postgres function was discovered. Adding `aws_regions` to a blacklist to that function resolved that issue. Deployment of `v0.0.20` successfully occurred after that and the Prisma end-to-end test fix was not truly necessary as `delete_all_records` is not meant for general consumption (yet).
- **2022-09-16**: A strange behavior was detected in the production instance. `main` was not clean at that point and it was assumed it was related to that, so the code was cleaned and an out-of-band production deploy was done, and the problem was apparently resolved.
- **2022-09-19**: An investigation determined that was not the root cause, [the issue was reproduced and then fixed](https://github.com/alantech/iasql-engine/pull/1297) and a second out-of-band deploy occurred, resolving the outage completely.

## Detection

We tried to deploy `v0.0.19` to production and it failed.

## Response

`v0.0.19` was intended to be the first release beginning multi-region support for AWS accounts, which altered several core assumptions in the codebase and was expected to be potentially difficult to deploy. Care was taken to getting a full test suite passed and staging deployments working, as well as manual testing of the upgrade path, but that manual testing was incomplete. Roughly a week from detection to resolution occurred, though it could have been successfully deployed a couple of days earlier, but another error, which turned out to be unrelated, was detected and also resolved before deployment of `v0.0.20`.

To attempt to minimize the impact on the team, only David worked on this issue, while feature development continued for others.

## Cause

The issue was due to a recent internal behavior change for the IaSQL functions to mitigate a problem discovered by a user. Most of the postgres functions exposed by `iasql_functions` now automatically fail to execute if an `iasql_upgrade` function call is running in the background, to prevent accidental corruption of the database during the upgrade. The `iasql-engine` side of the `iasql_upgrade` function uses these functions to do its work, and must manually turn off this protection logic to successfully call them. A new call to `iasql_sync` introduced by the multi-region support did not do so.

This was not detected by the test suite because we had no upgrade test, and it was not detected by the manual upgrade test because it only affected testing *after* the `aws_account` module was re-installed, not before it, and had no apparent impact if the default AWS region was chosen to be `us-east-1`. The manual testing did not install any other modules or use a different AWS region, and so never experienced the issue.

Our production and staging IaSQL databases do not use `us-east-1` and have more than just the `aws_account` installed, so they did run into this issue when the deploy logic upgraded them to the latest version of the engine.

After that, an issue with the `Context` object within the engine was discovered due to a new usage of it inside of the refactored `aws_account`. The issue was with the caching of the context object not being completely eliminated between requests due to shallow copies being made. This was also not discovered in the test suite because we have not tested concurrent, separate tests in the exact same running engine.

## Prevention

The mitigation for this exact issue has already been performed to get `v0.0.20` released, and an explicit test to confirm the full flow of an `iasql_upgrade` call works has been written.

All of the errors were due to missing test cases to prevent regression of functionality:

- `iasql_upgrade` didn't have a formal test case at all.
- The new `default_aws_region` only had partial coverage of its use-cases.
- `delete_all_records` never had a test that utilized an IaSQL database *after* it was run on it.
- The `Context` construction had never been tested with multiple different databases being manipulated in the same test suite before.

Some of these were obvious, such as not having test coverage for a user-accessible feature at all and relying on manual testing, but some are not obvious due to the inherent complexities that arise from Turing-complete syntaxes and unexpected starting states for the code to execute on. We therefore cannot expect all of these cases to be caught ahead of time, but we can minimize the impact by following a few extra rules with feature development:

1. All features have a test, or they can't be merged.
2. All bugfixes start with a test that triggers the bug, and end with the fix that prevents it and causes the test to pass.
3. End-to-end tests that utilize more and more modules in different ways to help prevent cross-module interaction regressions.