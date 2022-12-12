---
id: "aws_lambda_entity_lambda_function.LambdaFunction"
title: "Table: lambda_function"
sidebar_label: "lambda_function"
custom_edit_url: null
---

Table to manage AWS Lambda functions.

**`Example`**

```sql
INSERT INTO lambda_function (name, zip_b64, handler, runtime, role_name) VALUES ('lambda', '<base64_encoded_code>', 'index.handler', 'nodejs16.x', 'lambda_role');
SELECT * FROM lambda_function WHERE name = 'lambda';
DELETE FROM lambda_function WHERE name = 'lambda';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-lambda-integration.ts#L168
 - https://aws.amazon.com/lambda/

## Columns

• `Optional` **architecture**: [`architecture`](../enums/aws_lambda_entity_lambda_function.Architecture.md)

Architecture set used by the function

___

• `Optional` **arn**: `string`

AWS ARN for the function

___

• `Optional` **description**: `string`

Description for the function

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/configuration-versions.html

___

• `Optional` **environment**: `Object`

Complex type to represent the environment vars passed to the function

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html

#### Index signature

▪ [key: `string`]: `string`

___

• `Optional` **handler**: `string`

Method in your function code that processes events

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html

___

• `Optional` **memory\_size**: `number`

Memory allocated to the lambda function

**`See`**

https://docs.aws.amazon.com/lambda/latest/operatorguide/computing-power.html

___

• **name**: `string`

Name to identify the function

___

• **package\_type**: [`zip`](../enums/aws_lambda_entity_lambda_function.PackageType.md#zip)

Type of packaging used by this function. Only "zip" is supported

___

• **region**: `string`

Region for the function

___

• **role**: [`iam_role`](aws_iam_entity_role.IamRole.md)

Role used by the function

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html

___

• `Optional` **runtime**: [`runtime`](../enums/aws_lambda_entity_lambda_function.Runtime.md)

Language runtime used in this function

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html

___

• **security\_groups**: [`security_group`](aws_security_group_entity.SecurityGroup.md)[]

List of security groups associated to this function.
Only used when the lambda is on a private VPC

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html

___

• `Optional` **subnets**: `string`[]

List of associated subnets to this function. Only used when the
lambda is on a private VPC

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html

___

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the function

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/configuration-tags.html
TODO: find a way to add string values only constraint
TODO: find a way to add at least one key constraint

#### Index signature

▪ [key: `string`]: `string`

___

• `Optional` **version**: `string`

Version used to manage the function deployment

**`See`**

https://docs.aws.amazon.com/lambda/latest/dg/configuration-versions.html

___

• `Optional` **zip\_b\_64**: `string`

The base64-encoded contents of the deployment package.
This currently work as input value. After creation the value is set to null.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-lambda/interfaces/functioncode.html#zipfile
TODO: Validate string content is a valid b64 encoded zip file
TODO: Add flag to keep code around. Try to get code back from lambda s3 bucket.
