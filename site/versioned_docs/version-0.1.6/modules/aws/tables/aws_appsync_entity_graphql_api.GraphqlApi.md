---
id: "aws_appsync_entity_graphql_api.GraphqlApi"
title: "graphql_api"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage GraphQL API entires

**`See`**

https://aws.amazon.com/appsync

## Columns

• **api\_id**: `string`

AWS ID for the GraphQL entry

• **arn**: `string`

ARN for the AWS resource

• **authentication\_type**: [`authentication_type`](../enums/aws_appsync_entity_graphql_api.AuthenticationType.md)

Authentication type for the endpoint

• `Optional` **lambda\_authorizer\_config**: `Object`

Specific configuration for Lambda Authentication Type

**`See`**

https://docs.aws.amazon.com/appsync/latest/devguide/security-authz.html

#### Type declaration

| Name | Type |
| :------ | :------ |
| `authorizer_result_ttl_in_seconds` | `undefined` \| `number` |
| `authorizer_uri` | `undefined` \| `string` |
| `identity_validation_expression` | `undefined` \| `string` |

• **name**: `string`

Name to identify the GraphQL entry

• `Optional` **open\_id\_connect\_config**: `Object`

Specific configuration for the Open ID authentication type

**`See`**

https://docs.aws.amazon.com/appsync/latest/devguide/security-authz.html

#### Type declaration

| Name | Type |
| :------ | :------ |
| `auth_ttl` | `undefined` \| `number` |
| `client_id` | `undefined` \| `string` |
| `ia_ttl` | `undefined` \| `number` |
| `issuer` | `undefined` \| `string` |

• **region**: `string`

Region where the API gateway will be created

**`See`**

https://docs.aws.amazon.com/appsync/latest/devguide/security-authz.html

• `Optional` **tags**: `Object`

Complex type to provide identifier tags

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-appsync/interfaces/graphqlapi-3.html#tags-4

#### Type definition

▪ [key: `string`]: `string`

• `Optional` **user\_pool\_config**: `Object`

Specific configuration for Cognito authentication type

**`See`**

https://docs.aws.amazon.com/appsync/latest/devguide/security-authz.html

#### Type declaration

| Name | Type |
| :------ | :------ |
| `app_id_client_regex` | `undefined` \| `string` |
| `aws_region` | `undefined` \| `string` |
| `default_action` | `undefined` \| [`default_action`](../enums/aws_appsync_entity_graphql_api.DefaultAction.md) |
| `user_pool_id` | `undefined` \| `string` |
