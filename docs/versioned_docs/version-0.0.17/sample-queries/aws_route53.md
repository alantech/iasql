---
sidebar_position: 7
slug: '/aws_route53'
---

# AWS Route53 Hosted Zones

Install the AWS Route53 module for hosted zones. Read more about AWS Route53 hosted zones [here](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-working-with.html).

```sql
SELECT * FROM iasql_install('aws_route53_hosted_zones');
```

## Create a hosted zone

Create a hosted zone and new record within it. Finally, `apply` it.

```sql
INSERT INTO hosted_zone (domain_name)
VALUES ('iasqlsample.com');

INSERT INTO resource_record_set (name, record_type, record, ttl, parent_hosted_zone_id)
SELECT 'test.iasqlsample.com', 'CNAME', 'example.com.', 300, id
FROM hosted_zone
WHERE domain_name = 'iasqlsample.com';

SELECT * FROM iasql_apply();
```

<!--- https://www.urlencoder.org/ -->
<button
  className={"button button--primary button--lg margin-bottom--lg"}
  onClick={() => window.open('https://app.iasql.com/#/button/INSERT%20INTO%20hosted_zone%20%28domain_name%29%0AVALUES%20%28%27iasqlsample.com%27%29%3B%0A%0AINSERT%20INTO%20resource_record_set%20%28name%2C%20record_type%2C%20record%2C%20ttl%2C%20parent_hosted_zone_id%29%0ASELECT%20%27test.iasqlsample.com%27%2C%20%27CNAME%27%2C%20%27example.com.%27%2C%20300%2C%20id%0AFROM%20hosted_zone%0AWHERE%20domain_name%20%3D%20%27iasqlsample.com%27%3B%0A%0ASELECT%20%2A%20FROM%20iasql_apply%28%29%3B', '_blank')}
>
Run SQL
</button>

## Check default record sets have been added

Join over the [`hosted_zone`](https://dbdocs.io/iasql/iasql?table=hosted_zone&schema=public&view=table_structure) and [`resource_record_set`](https://dbdocs.io/iasql/iasql?table=resource_record_set&schema=public&view=table_structure) tables.

```sql
SELECT *
FROM resource_record_set
INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
WHERE domain_name = 'iasqlsample.com';
```
<!--- https://www.urlencoder.org/ -->
<button
  className={"button button--primary button--lg margin-bottom--lg"}
  onClick={() => window.open('https://app.iasql.com/#/button/SELECT%20%2A%0AFROM%20resource_record_set%0AINNER%20JOIN%20hosted_zone%20ON%20hosted_zone.id%20%3D%20parent_hosted_zone_id%0AWHERE%20domain_name%20%3D%20%27iasqlsample.com%27%3B', '_blank')}
>
Run SQL
</button>