---
id: "iasql_platform_entity.IasqlAuditLog"
title: "iasql_audit_log"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to track the changes performed in the tables managed by IaSQL.
It contains information about user, performed change and timestamp.

• **change**: `Object`

Complex type to reflect the performed change

#### Type declaration

| Name | Type |
| :------ | :------ |
| `change` | `any` |
| `original` | `any` |

• **change\_type**: [`audit_log_change_type`](../enums/iasql_platform_entity.AuditLogChangeType.md)

Type of change

• **message**: `string`

Descriptive message of the change

• **table\_name**: `string`

Name of the affected table

• **transaction\_id**: `string`

Transaction identifier

• **ts**: `date`

Timestamp of the change

• **user**: `string`

User that committed the change
