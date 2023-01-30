---
id: "aws_route53_entity_resource_records_set.ResourceRecordSet"
title: "Table: resource_record_set"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS Route 53 recordsets. After you create a hosted zone for your domain, such as example.com, you create records to tell the
Domain Name System (DNS) how you want traffic to be routed for that domain. Each record includes the name of a domain or a subdomain,
a record type (for example, a record with a type of MX routes email), and other information applicable to the record type (for MX records, the host name of one or more mail servers and a priority for each server).

**`Example`**

```sql TheButton[Manage a RecordSet]="Manage a RecordSet"
INSERT INTO resource_record_set (name, record_type, record, ttl, parent_hosted_zone_id) SELECT 'name', 'CNAME', 'domain.com.', 300, id
FROM hosted_zone WHERE domain_name = 'domain.com.';

SELECT * FROM resource_record_set INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id WHERE domain_name = 'domain.com.';

DELETE FROM resource_record_set USING hosted_zone WHERE hosted_zone.id IN (SELECT id FROM hosted_zone WHERE domain_name = 'domain.com.' ORDER BY ID DESC LIMIT 1);
```

**`See`**

 - https://github.com/iasql/iasql/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-route53-integration.ts#L294
 - https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/rrsets-working-with.html

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
