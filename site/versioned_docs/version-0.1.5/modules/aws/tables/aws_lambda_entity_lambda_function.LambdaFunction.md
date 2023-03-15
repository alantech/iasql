---
id: "aws_lambda_entity_lambda_function.LambdaFunction"
title: "lambda_function"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS Lambda functions. AWS Lambda is a serverless, event-driven compute service that lets you run code
for virtually any type of application or backend service without provisioning or managing servers.

You can trigger Lambda from over 200 AWS services and software as a service (SaaS) applications, and only pay for what you use.

**`See`**

https://aws.amazon.com/lambda/

## Columns

• `Optional` **architecture**: [`architecture`](../enums/aws_lambda_entity_lambda_function.Architecture.md)

Architecture set used by the function

• `Optional` **arn**: `string`

AWS ARN for the function

• `Optional` **description**: `string`

Description for the function

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/configuration-versions.html

• `Optional` **environment**: `Object`

Complex type to represent the environment vars passed to the function

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html

#### Type definition

▪ [key: `string`]: `string`

• `Optional` **handler**: `string`

Method in your function code that processes events

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html

• `Optional` **memory\_size**: `number`

Memory allocated to the lambda function

**`See`**

https://docs.aws.amazon.com/lambda/latest/operatorguide/computing-power.html

• **name**: `string`

Name to identify the function

• **package\_type**: [`zip`](../enums/aws_lambda_entity_lambda_function.PackageType.md#zip)

Type of packaging used by this function. Only "zip" is supported

• **region**: `string`

Region for the function

• **role**: [`iam_role`](aws_iam_entity_role.IamRole.md)

Role used by the function

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html

• `Optional` **runtime**: [`runtime`](../enums/aws_lambda_entity_lambda_function.Runtime.md)

Language runtime used in this function

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html

• **security\_groups**: [`security_group`](aws_security_group_entity.SecurityGroup.md)[]

List of security groups associated to this function.
Only used when the lambda is on a private VPC

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html

• `Optional` **subnets**: `string`[]

List of associated subnets to this function. Only used when the
lambda is on a private VPC

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the function

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/configuration-tags.html

#### Type definition

▪ [key: `string`]: `string`

• `Optional` **version**: `string`

Version used to manage the function deployment

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/configuration-versions.html

• `Optional` **zip\_b\_64**: `string`

The base64-encoded contents of the deployment package.
This currently work as input value. After creation the value is set to null.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-lambda/interfaces/functioncode.html#zipfile
