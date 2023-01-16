---
id: "aws_lambda_rpcs_invoke.LambdaFunctionInvokeRpc"
title: "Method: lambda_function_invoke"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Method to trigger a call to an specific Lambda function

Returns following columns:
- function_name: Name of the function called
- version: version of the function called
- status: status of the trigger call. OK if succeeded
- payload: payload used to call the function
- error: Error message in case of failure

Accepts the following parameters:
- functionName: Name of the Lambda function to invoke
- payload: payload used to call the function
- region: Region where the function is stored

**`Example`**

```sql TheButton[Invoke a Lambda Function]="Invoke a Lambda Function"
SELECT * FROM invoke_lambda('function_name', '{name: test}');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-lambda-integration.ts#L260
 - https://docs.aws.amazon.com/es_es/lambda/latest/dg/API_Invoke.html
