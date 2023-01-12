# 002 - Postmortem for v0.0.23 release

## Level: Internal

## Author(s)

- David Ellis <david@iasql.com>

## Summary

We have been unable to release v0.0.23, a significant rearchitecting and feature-adding version of IaSQL, for approximately a month, *primarily* due to issues with the new infrastructure required in staging and production. There are five incidences we have observed on staging (none on production as production is not yet in use) and we have applied mitigations to staging and production for them all. This document will outline them.

## Timeline

- **2022-12-20**: Staging cannot load docker container images because it has run out of disk space. Increased boot volume to 16GB.
- **2022-12-27**: Staging deploys fail complaining about lack of disk space, again. Dropping `stdout/err` in favor of LogDNA recommended.
- **2023-01-03**: Staging `run` service crashed, cannot be deployed automatically. Deployment code written, better logging and auto-restart added to `run` service. Discord altering on staging/production status revived.
- **2023-01-08**: Staging instance becomes unreachable. Somehow the DHCP daemon failed to get an IP address assigned by AWS. Manually stopping and starting the server revived it.
- **2023-01-11**: Staging cannot deploy. Authorization to ghcr.io failed. Replaced Github Personal Access Token. Recommend monthly calendar task to replace the token until ghcr.io is replaced with dockerhub (potentially).

## Detection

Our test suite for the Dashboard uses staging, so tests there start failing, but with low activity over the holidays, this was delayed for the January 3rd situation. The first and last issue happened during deployment so they were noticed immediately. The lack of disk space on December 27th and the instance being unreachable on January 8th were only spotted by deployment failures (but not caused by them). They should be spotted sooner now that Discord health notifications have been revived.

## Response, Cause, Prevention

Combining these three sections because most of the incidents were relatively easy to figure out and resolve.

Four of the five cases have had improvements made to varying degrees of satisfaction. The first and second outages were caused by disk space usage issues; simply increasing the disk space on the first and minimizing the usage of `stdout/stderr` in staging and production will avoid the lack of log rotation in Docker. The root cause of the January 3rd incident was not discovered but by the complete lack of errors in `journalctl` we can be sure the docker process stopped due to an application-level error, so we added improved logging and auto-restart of the `run` process to auto-recover from whatever happened. The last error was simply the github personal access token expiring, so it was replaced. ghcr.io's docuementation requires the "classic" token, which has full access to everything that account has access to, so using a non-expiring token would be risky, so simply adding a calendar event to replace the token monthly is the only good course to take here.

I'm singling out the incident on January 8th because after detailed digging into the server logs, the root cause was the DHCP server failing to renew its IP address with AWS, which I have *never* seen before in the past ~12 years of using AWS. I have no recommendations for mitigation beyond the detection of staging being down, as annoying as that is. I hope we never see it again.