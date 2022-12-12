---
id: "aws_appsync_entity_graphql_api.GraphqlApi"
title: "Table: graphql_api"
sidebar_label: "graphql_api"
custom_edit_url: null
---

Table to manage GraphQL API entires

**`Example`**

```sql
 INSERT INTO graphql_api (name, authentication_type) VALUES ('graphql-api', 'API_KEY');
 UPDATE graphql_api SET authentication_type='AWS_IAM' WHERE name='graphql-api';
 DELETE FROM graphql_api WHERE name = 'graphql-api';
 SELECT * FROM graphql_api WHERE name='graphql-api';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-appsync-integration.ts#L95
 - https://aws.amazon.com/appsync

## Columns

• **api\_id**: `string`

AWS ID for the GraphQL entry

___

• **arn**: `string`

ARN for the AWS resource

___

• **authentication\_type**: [`authentication_type`](../enums/aws_appsync_entity_graphql_api.AuthenticationType.md)

Authentication type for the endpoint

___

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

___

• **name**: `string`

Name to identify the GraphQL entry

___

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

___

• **region**: `string`

Region where the API gateway will be created

**`See`**

https://docs.aws.amazon.com/appsync/latest/devguide/security-authz.html

___

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
