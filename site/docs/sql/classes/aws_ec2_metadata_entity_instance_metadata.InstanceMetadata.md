---
id: "aws_ec2_metadata_entity_instance_metadata.InstanceMetadata"
title: "Table: instance_metadata"
sidebar_label: "instance_metadata"
custom_edit_url: null
---

Table to collect detailed information for all EC2 instances. It is directly
associated to each instance.
It is a read-only table.

**`Example`**

```sql
SELECT * FROM instance_metadata WHERE instance_id = (SELECT instance_id FROM instance WHERE tags ->> 'name' = 'test');
```

**`See`**

https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-ec2-integration.ts#L1096

## Columns

• **architecture**: [`architecture`](../enums/aws_ec2_metadata_entity_instance_metadata.Architecture.md)

Architecture used for the instance

___

• **cpu\_cores**: `number`

Number of CPU cores assigned to the instance

___

• **ebs\_optimized**: `boolean`

If it is optimized for EBS

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ebs-optimized.html

___

• `Optional` **id**: `number`

Reference to the instance for what we are exposing the information
same id as the `instance` table

___

• **instance\_id**: `string`

Internal AWS ID for the instance

___

• **launch\_time**: `date`

Time when the instance was launched

___

• **mem\_size\_mb**: `number`

Memory in MB assigned to the instance

___

• **private\_ip\_address**: `string`

Private IPV4 address

___

• `Optional` **public\_dns\_name**: `string`

Public DNS name

___

• `Optional` **public\_ip\_address**: `string`

Public IPV4 address

___

• **region**: `string`

Region for the instance

___

• `Optional` **root\_device\_name**: `string`

Name assigned to the root device

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/RootDeviceStorage.html

___

• **root\_device\_type**: [`root_device_type`](../enums/aws_ec2_metadata_entity_instance_metadata.RootDeviceType.md)

Type of root device used by the instance
