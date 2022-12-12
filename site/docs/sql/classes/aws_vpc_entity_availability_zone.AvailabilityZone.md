---
id: "aws_vpc_entity_availability_zone.AvailabilityZone"
title: "Table: availability_zone"
sidebar_label: "availability_zone"
custom_edit_url: null
---

Table to manage AWS availability zones. This is a read-only table.

**`Example`**

```sql
SELECT * FROM availability_zone;
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-vpc-integration.ts#L112
 - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html

## Columns

• **name**: `string`

Name for the availability zone

___

• **region**: `string`

Reference to the region where it belongs
