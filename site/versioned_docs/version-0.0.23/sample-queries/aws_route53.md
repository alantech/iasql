---
sidebar_position: 7
slug: '/aws_route53'
---

# AWS Route53

Install the AWS Route53 module for hosted zones. Read more about AWS Route53 hosted zones [here](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-working-with.html).

```sql
SELECT * FROM iasql_install('aws_route53');
```

## Create a hosted zone

Create a hosted zone and new record within it. Finally, `apply` it.

```sql TheButton
INSERT INTO hosted_zone (domain_name)
VALUES ('iasqlsample.com');

INSERT INTO resource_record_set (name, record_type, record, ttl, parent_hosted_zone_id)
SELECT 'test.iasqlsample.com', 'CNAME', 'example.com.', 300, id
FROM hosted_zone
WHERE domain_name = 'iasqlsample.com';

SELECT * FROM iasql_apply();
```

## Check default record sets have been added

Join over the [`hosted_zone`](https://dbdocs.io/iasql/iasql?table=hosted_zone&schema=public&view=table_structure) and [`resource_record_set`](https://dbdocs.io/iasql/iasql?table=resource_record_set&schema=public&view=table_structure) tables.

```sql TheButton
SELECT *
FROM resource_record_set
INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
WHERE domain_name = 'iasqlsample.com';
```
