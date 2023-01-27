---
slug: beta
title: IaSQL is in beta!
date: 2023-02-05
authors: [yrobla, mtp1376, depombo, dfellis, aguillenv]
tags: [announcement]
---

IaSQL lets developers manage their cloud infrastructure as data in PostgreSQL as an alternative to the AWS console and infrastructure as code (IaC) tools like Pulumi and Terraform. We open-sourced IaSQL's Alpha version (v0.0.x) in [April 2022](/blog/os-iasql). We’ve been fortunate to work with lots of early adopters who helped us shape the product and prioritize the features to build.

We have been quietly fixing bugs and adding goodies to IaSQL non-stop for the past few months. Some of the bugs have led to some difficult outages. We love open source and that includes airing our dirty laundry. We keep our postmorterms [here](https://github.com/iasql/iasql/tree/main/postmortems) in case you are curious.

<img width={340} src={'https://media.tenor.com/znsYWE0DQKsAAAAC/cats-laundry.gif'} />

We still have a long way to go, but we feel ready for what is next. Today, we’re moving IaSQL to Beta (v0.x)!

Additionally, we completely redid our architecture to scale and our UX to make it more intuitive and just plain simpler. More on that later. Several hundred SQL queries and cloud resources have been created on top of IaSQL. Blood, sweat, and tears went into the Alpha phase. Okay, that may be an overdramatization, but it did take a lot of thoughtful hours from us to help you manage cloud infrastructure more seamlessly.

<img width={340} src={'https://media.tenor.com/Nbv1SysxlrUAAAAC/heavenly-joy-jerkins-i-am-so-excited.gif'} />

## Alpha phase in numbers​

- 25 Alpha versions
- 170 databases created
- 198 GitHub stars
- 11 GitHub contributors
- 434 GitHub issues closed
- 116,840 lines of code
- 20 AWS services covered
- 88 Discord members

Here are the new features that ship in the Beta versions of IaSQL:

## 🎛️ AWS Multiregion

Support for multiple AWS regions with default region behavior in part because we also hate changing regions in the AWS console. The default region is defined when connecting your database to your AWS account. Thereon, IaSQL's data model will assume the default data model unless you explicitly override it in the column that represents your cloud resource.

[Learn more about it in the RFC for this feature &#8594;](https://github.com/iasql/iasql/blob/main/rfcs/003%20-%20Multi-Region%20Support%20RFC.md)

## 🪄 Automagically, please

We redid the UX to allow handling infrastructure changes automatically and wrapping delicate, or complex, changes within a special IaSQL transaction akin to transactions in a regular database. This means no more `apply`. Do you want to programmatically modify your infra or control plane? We got you!

[Learn more about it in the RFC for this feature &#8594;](https://github.com/iasql/iasql/blob/main/rfcs/004%20-%20Continuous%20Two-Way%20Synchronization%20RFC.md)

## 🎚️ Moar coverage of AWS services

Increased AWS service coverage for EC2, CodeDeploy, CodeBuild, CodePipeline, SNS, ACM, Route53 amongst a few others.

[See an up-to-date list of covered AWS services &#8594;](https://github.com/iasql/iasql#aws-services-with-significant-api-coverage)


## 📈 Scale for what?

Re-architected the product to scale the SaaS beyond a handful of users and allow automatic database version upgrades for [modules](/docs/modules). 

[Learn more about it in the RFC for this feature &#8594;](https://github.com/iasql/iasql/blob/main/rfcs/005%20-%20Unsurprising%20Functions%20and%20Scalability%20RFC.md)
