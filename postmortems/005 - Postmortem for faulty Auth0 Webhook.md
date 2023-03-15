# 004 - Postmortem for faulty Auth0 PostLogin JS webhook

## Level: Internal

## Author(s)

- Luis Fernando De Pombo <l@iasql.com>

## Summary

The addition of an Auth0 PostLogin JS webhook, which turned out to run during log-in and not after it, caused a redirect loop in the production dashboard and made production unavailable when the webhook failed to run to completion which would happen most of the time.

## Timeline

- **2023-03-14**: @depombo added the faulty Auth0 PostLogin JS webhook
- **2023-03-15**: @depombo tried to access the production dashboard and noticed that it wasn't possible

## Detection

The problem was around for roughly 16 hours when the faulty Auth0 PostLogin JS webhook was added until there was an attempt to access the production dashboard that did not work.

## Response

Once we verified the docker logs looked okay and we redeployed production, we noticed the Auth0 logs showed failed attempts to log in.
The webhook was removed which fixed the issue immediately.

## Cause

The Auth0 JS webhook accessed a field within an Auth0 API object that was sometimes `undefined`. Adding a conditional that checked the field was defined made the webhook run the completion every time and fixed the issue. 

## Prevention

- Adding a try/catch to all Auth0 JS webhooks.
- Test Auth0 webhooks work in staging before putting them in production.
- We currently have periodic checks that alert us if the production or staging docker containers become suddenly unavailable. However, we have no ongoing tests that check if the staging or production dashboards are available. We currently have an integration test that checks if the staging dashboard is up and running, but this only happens during a staging deployment. We can replicate this integration test for production and run it periodically to get alerted when the production dashboard is not accessible.