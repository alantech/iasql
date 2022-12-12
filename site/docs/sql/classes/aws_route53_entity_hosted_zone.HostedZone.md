---
id: "aws_route53_entity_hosted_zone.HostedZone"
title: "Table: hosted_zone"
sidebar_label: "hosted_zone"
custom_edit_url: null
---

Table to manage AWS Route 53 hosted zones: a hosted zone is a container for records, and
records contain information about how you want to route traffic for a specific domain

**`Example`**

```sql
INSERT INTO hosted_zone (domain_name) VALUES ('domain.com');
SELECT * FROM hosted_zone WHERE domain_name = 'domain.com';
DELETE FROM hosted_zone WHERE domain_name = 'domain.com';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-route53-integration.ts#L121
 - https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-working-with.html

## Columns

• **hosted\_zone\_id**: `string`

AWS ID to identify the hosted zone
