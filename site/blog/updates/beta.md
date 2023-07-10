---
slug: beta
title: "IaSQL is in beta!"
description: "IaSQL is in beta: AWS multiregion + infra changes as transactions + smooth local setup"
image: https://iasql.com/img/iasql-connector_dark.gif
date: 2023-02-16
authors: [yrobla, mtp1376, depombo, dfellis, aguillenv]
tags: [updates]
---

IaSQL lets developers manage their cloud infrastructure as data in PostgreSQL as an alternative to the AWS console and infrastructure as code (IaC) tools like Pulumi and Terraform. We open-sourced IaSQL's Alpha version (v0.0.x) in [April 2022](/blog/os-iasql). We still have a long way to go, but we feel ready for what is next. Today, we’re moving IaSQL to Beta (v0.x)!

<!--truncate-->

We’ve been fortunate to work with lots of early adopters who helped us shape the product and prioritize the features to build. We have been quietly fixing bugs and adding goodies to IaSQL non-stop for the past few months. Some of the bugs have led to some difficult outages. We love open source and that includes airing our dirty laundry. We keep our postmortems [here](https://github.com/alantech/iasql/tree/main/postmortems) in case you are curious.

<img width={340} src={'https://media.tenor.com/znsYWE0DQKsAAAAC/cats-laundry.gif'} />

Additionally, we completely redid our architecture to scale and our UX to make it more intuitive and just plain simpler. More on that later. Several hundred SQL queries and cloud resources have been created on top of IaSQL. Blood, sweat, and tears went into the Alpha phase. Okay, that may be an overdramatization, but it did take a lot of thoughtful hours from us to help you manage cloud infrastructure more seamlessly.

<img width={340} src={'https://media.tenor.com/Nbv1SysxlrUAAAAC/heavenly-joy-jerkins-i-am-so-excited.gif'} />

## Alpha phase in numbers​

- 26 Alpha versions
- 170 databases created
- 199 GitHub stars
- 11 GitHub contributors
- 481 GitHub issues closed
- 140,755 lines of code and markdown
- 24 AWS services covered
- 90 Discord members

## New features

Here are the new features that ship in the Beta versions of IaSQL:

### 🏡 Home is where your local env is

We made IaSQL easier to run locally by bundling up our dashboard into the IaSQL docker container and publishing it to [Dockerhub](https://hub.docker.com/r/iasql/iasql). This makes IaSQL easier to try out without having your cloud credentials ever leave your local environment. It is as simple as running the command below and going to `http://localhost:9876` on your preferred browser.

```bash
docker run --pull=always -p 9876:9876 -p 5432:5432 --name iasql iasql/iasql
```

### 🎛️ AWS Multiregion

Support for multiple AWS regions with default region behavior in part because we also hate changing regions in the AWS console. The default region is defined when connecting your database to your AWS account. Thereon, IaSQL's data model will assume the default data model unless you explicitly override it in the column that represents your cloud resource.

[Learn more about it in the RFC for this feature &#8594;](https://github.com/alantech/iasql/blob/main/rfcs/003%20-%20Multi-Region%20Support%20RFC.md)

### 🪄 Infrastructure changes as transactions, please

We redid the UX to allow handling infrastructure changes automatically and for delicate, or complex, changes to your cloud account use an [IaSQL transaction](/docs/transaction) akin to transactions in a regular database. Do you want to programmatically modify your infra or control plane? We got you!

[Learn more about it in the RFC for this feature &#8594;](https://github.com/alantech/iasql/blob/main/rfcs/004%20-%20Continuous%20Two-Way%20Synchronization%20RFC.md)

### 🎚️ Moar coverage of AWS services

Increased AWS service coverage for EC2, CodeDeploy, CodeBuild, CodePipeline, SNS, ACM, Route53 amongst a few others. Additionally, we have a new `aws_sdk` module that lets you invoke the AWS SDK directly using PostgreSQL functions with added type safety.

[See an up-to-date list of covered AWS services &#8594;](/docs/modules/)

### 💨 Breeze through a simplified AWS

AWS is well... complicated. Our modules let you create, update, and delete your cloud resources as relational tables with the configurability AWS provides, but sometimes those details are not relevant to what you are trying to accomplish. So we have developed simplified modules that focus on specific use cases. For instance deploying a docker container to ECS and exposing it to the internet which is not just ECS but involves ECR, ECS, ACM, and Route53. These simplified modules are written in pure SQL on top of the existing IaSQL modules and are meant to abstract the complexity of coordinating multiple AWS services while still letting you peek under the hood when needed. Think of a simplified module as a PaaS hosted in your AWS account that is built on top of known AWS services but also lets you eject back into these AWS services if necessary.

[Learn more about simplified modules here &#8594;](/blog/ecs-simplified)

### 📈 Scale for what?

Re-architected the product to scale the SaaS beyond a handful of users and allow automatic database version upgrades for [modules](/docs/modules). 

[Learn more about it in the RFC for this feature &#8594;](https://github.com/iasql/iasql/blob/main/rfcs/005%20-%20Unsurprising%20Functions%20and%20Scalability%20RFC.md)

## What’s next?​

The next features are going to be about making IaSQL easier to use:
- more [examples](/blog/tags/tutorial/)
- SQL templates for common security vulnerabilities and cost optimizations in AWS
- continuously improving our documentation

Longer term, we’ll add support for 3rd party high-level modules, extensive support for AWS, and support for more cloud providers. If there is something in particular you would like to see please drop us a line on [Discord](https://discord.iasql.com) or email via hello at our domain.

*Want to stay in the loop? → [Join our newsletter!](/updates)*