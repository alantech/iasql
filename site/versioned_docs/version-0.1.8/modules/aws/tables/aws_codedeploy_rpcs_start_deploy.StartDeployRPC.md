---
id: "aws_codedeploy_rpcs_start_deploy.StartDeployRPC"
title: "start_deploy"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method for deploying a CodeDeploy application revision through a deployment group.

Accepts the following parameters:

- application: name of the application to deploy

- deployment group: name of the deployment group to use

- revision: complex type specifying the type and location of the revision to deploy

- region: region where to trigger the deployment

Returns following columns:

- id: the ID of the triggered deployment

- status: OK if the build was started successfully

- message: Error message in case of failure

**`See`**

https://docs.aws.amazon.com/cli/latest/reference/deploy/create-deployment.html
