---
id: "aws_route53_entity_resource_records_set.ResourceRecordSet"
title: "resource_record_set"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS Route 53 recordsets. After you create a hosted zone for your domain, such as example.com, you create records to tell the
Domain Name System (DNS) how you want traffic to be routed for that domain. Each record includes the name of a domain or a subdomain,
a record type (for example, a record with a type of MX routes email), and other information applicable to the record type (for MX records, the host name of one or more mail servers and a priority for each server).

**`See`**

https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/rrsets-working-with.html

## Columns

• `Optional` **alias\_target**: [`alias_target`](aws_route53_entity_alias_target.AliasTarget.md)

Reference to the alias target for this record

• **name**: `string`

Name for the recordset

• **parent\_hosted\_zone**: [`hosted_zone`](aws_route53_entity_hosted_zone.HostedZone.md)

Reference to the hosted zone for this record

• `Optional` **record**: `string`

Content for the record to create. Content will depend on the type of record to create

**`See`**

https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-values-basic.html#rrsets-values-basic-value

• **record\_type**: [`record_type`](../enums/aws_route53_entity_resource_records_set.RecordType.md)

Type of record to create

• `Optional` **ttl**: `number`

The amount of time, in seconds, that you want DNS recursive resolvers to cache information about this record

**`See`**

https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-values-basic.html#rrsets-values-basic-ttl
