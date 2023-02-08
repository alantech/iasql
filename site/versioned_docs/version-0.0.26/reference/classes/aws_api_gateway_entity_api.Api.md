---
id: "aws_api_gateway_entity_api.Api"
title: "api"
displayed_sidebar: "docs"
sidebar_label: "Reference"
sidebar_position: 0
hide_table_of_contents: true
custom_edit_url: null
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS API gateway entries. Amazon API Gateway is a fully managed service that makes it easy for developers to
create, publish, maintain, monitor, and secure APIs at any scale.

APIs act as the "front door" for applications to access data, business logic, or functionality from your backend services.

**`See`**

https://aws.amazon.com/api-gateway/

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
