# 000 - Postmortem for [descriptive name here]

## Level: [Internal, Outage, Corruption, Breach]

## Author(s)

- Some Body <oncetoldme@iasql.com>

## Summary

This is a postmortem template for outages. In this section you should put a short summary of what happened and how it was resolved. Only one or two paragraphs at most.

Also, to explain the levels. An "Internal" outage is when our internal dev processes are broken and negatively impact the team. An "Outage" level is when service is interrupted for users, but zero impact on customer cloud accounts occurred. A "Corruption" level we hope to never see, which would imply accidental destruction of cloud resources in a customer account caused by us. Similarly "Breach" is a security breach which is similarly very harmful for users.

## Timeline

- **2022-09-14**: A timeline of events that occurred. No need to be super precise, but please use the ISO date format and UTC time if necessary since we're all over the globe.

## Detection

Describe in a paragraph how the issue was found out.

## Response

Describe in a paragraph or two what was done to resolve the issue.

## Cause

Try to describe a root cause for the issue in a paragraph.

## Prevention

Proposed changes to code and/or company process to avoid this in the future *or* a detailed explanation on why the cure would be worse than the disease.

This section can be structured however you like to get your point across, and is likely to have the most back-and-forth during postmortem review.

This is a *blameless* process. As long as no one was being actively malicious a proposal of punishment is not allowed.