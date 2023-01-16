---
id: "aws_codedeploy_rpcs_start_deploy.StartDeployRPC"
title: "Method: start_deploy"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

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

**`Example`**

```sql TheButton[Deploy CodeDeploy application]="Deploy CodeDeploy application"
  select * from start_deployment('test', 'test', '{
"revisionType": "GitHub",
"gitHubLocation": {
  "repository": "iasql/iasql-codedeploy-example",
  "commitId": "cf6aa63cbd2502a5d1064363c2af5c56cc2107cc"
}
}', 'us-east-2');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-codebuild-integration.ts#L313
 - https://docs.aws.amazon.com/cli/latest/reference/deploy/create-deployment.html

## Columns
