---
id: "aws_codebuild_entity_build.CodebuildBuildList"
title: "codebuild_build_list"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS CodeBuild build entities. AWS CodeBuild is a fully managed continuous integration service that
compiles source code, runs tests, and produces ready-to-deploy software packages.

A build represents a set of actions performed by AWS CodeBuild to create output artifacts (for example, a JAR file)
based on a set of input artifacts (for example, a collection of Java class files).

This table can only be used to check the existing builds, and delete them. The main builds are created
via a CodeBuild project.

**`See`**

https://docs.aws.amazon.com/codebuild/latest/userguide/builds-working.html

## Columns

• **arn**: `string`

AWS ARN to identify the build

• **aws\_id**: `string`

Internal ID to identify the build

• `Optional` **build\_number**: `number`

The number of the build. For each project, the buildNumber of its first build is 1. The buildNumber of each subsequent build is incremented by 1. If a build is deleted, the buildNumber of other builds does not change.

• **build\_status**: [`build_status`](../enums/aws_codebuild_entity_build.BuildStatus.md)

Current status for the build

• `Optional` **end\_time**: `date`

Time when the build finished

• **project**: [`codebuild_project`](aws_codebuild_entity_project.CodebuildProject.md)

Associated project for the build. AWS allows builds to exist once the project has been deleted

• **region**: `string`

Region for the certificate creation

• `Optional` **start\_time**: `date`

Time when the build was started
