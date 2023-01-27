---
id: "aws_vpc_entity_availability_zone.AvailabilityZone"
title: "Table: availability_zone"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS availability zones. An Availability Zone (AZ) is one or more discrete data
centers with redundant power, networking, and connectivity in an AWS Region.

This is a read-only table.

**`Example`**

```sql TheButton[Shows availability zones]="Shows availability zones"
SELECT * FROM availability_zone;
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-vpc-integration.ts#L92
 - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html

## Columns

• **name**: `string`

Name for the availability zone

• **region**: `string`

Reference to the region where it belongs
