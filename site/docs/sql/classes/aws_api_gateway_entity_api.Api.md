---
id: "aws_api_gateway_entity_api.Api"
title: "Table: api"
sidebar_label: "api"
custom_edit_url: null
---

Table to manage AWS API gateway entries.

**`Example`**

```sql
 INSERT INTO api (name, description, disable_execute_api_endpoint, version) VALUES ('api-name', 'description', false, '1.0');
 UPDATE api SET description='new description' WHERE name='api-name';
 DELETE FROM api WHERE name = 'api-name';
 SELECT * FROM api WHERE name='api-name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-api-gateway-integration.ts#L124
 - https://aws.amazon.com/api-gateway/

## Columns

• **api\_id**: `string`

AWS ID for the generated API gateway

___

• `Optional` **description**: `string`

Description

___

• `Optional` **disable\_execute\_api\_endpoint**: `boolean`

Wether disable API execution endpoint

**`See`**

https://docs.aws.amazon.com/apigateway/latest/developerguide/rest-api-disable-default-endpoint.html

___

• `Optional` **name**: `string`

Given name for the API gateway

___

• `Optional` **protocol\_type**: [`protocol`](../enums/aws_api_gateway_entity_api.Protocol.md)

Protocol for the API gateway

___

• **region**: `string`

Region where the API gateway will be created

___

• `Optional` **version**: `string`

Specific version for this publication
