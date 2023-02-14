---
id: "aws_lambda_rpcs_invoke.LambdaFunctionInvokeRpc"
title: "lambda_function_invoke"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

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

**`See`**

https://docs.aws.amazon.com/es_es/lambda/latest/dg/API_Invoke.html
