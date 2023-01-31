---
id: "aws_api_gateway_entity_api.Api"
title: "Table: api"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS API gateway entries. Amazon API Gateway is a fully managed service that makes it easy for developers to
create, publish, maintain, monitor, and secure APIs at any scale.

APIs act as the "front door" for applications to access data, business logic, or functionality from your backend services.

**`Example`**

```sql TheButton[Manage API Gateway]="Manage API gateway"
 INSERT INTO api (name, description, disable_execute_api_endpoint, version) VALUES ('api-name', 'description', false, '1.0');

 UPDATE api SET description='new description' WHERE name='api-name';

 SELECT * FROM api WHERE name='api-name';

 DELETE FROM api WHERE name = 'api-name';
```

**`See`**

 - https://github.com/iasql/iasql/blob/main/test/modules/aws-api-gateway-integration.ts#L124
 - https://aws.amazon.com/api-gateway/

## Columns

• **api\_id**: `string`

AWS ID for the generated API gateway

• `Optional` **description**: `string`

Description

• `Optional` **disable\_execute\_api\_endpoint**: `boolean`

Wether disable API execution endpoint

**`See`**

https://docs.aws.amazon.com/apigateway/latest/developerguide/rest-api-disable-default-endpoint.html

• `Optional` **name**: `string`

Given name for the API gateway

• `Optional` **protocol\_type**: [`protocol`](../enums/aws_api_gateway_entity_api.Protocol.md)

Protocol for the API gateway

• **region**: `string`

Region where the API gateway will be created

• `Optional` **version**: `string`

Specific version for this publication
