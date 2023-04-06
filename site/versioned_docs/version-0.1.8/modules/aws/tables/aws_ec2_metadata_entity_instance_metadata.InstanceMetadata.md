---
id: "aws_ec2_metadata_entity_instance_metadata.InstanceMetadata"
title: "instance_metadata"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to collect detailed information for all EC2 instances. It is directly
associated to each instance.
It is a read-only table.

## Columns

• **architecture**: [`architecture`](../enums/aws_ec2_metadata_entity_instance_metadata.Architecture.md)

Architecture used for the instance

• **cpu\_cores**: `number`

Number of CPU cores assigned to the instance

• **ebs\_optimized**: `boolean`

If it is optimized for EBS

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ebs-optimized.html

• `Optional` **id**: `number`

Reference to the instance for what we are exposing the information
same id as the `instance` table

• **instance\_id**: `string`

Internal AWS ID for the instance

• **launch\_time**: `date`

Time when the instance was launched

• **mem\_size\_mb**: `number`

Memory in MB assigned to the instance

• **private\_ip\_address**: `string`

Private IPV4 address

• `Optional` **public\_dns\_name**: `string`

Public DNS name

• `Optional` **public\_ip\_address**: `string`

Public IPV4 address

• **region**: `string`

Region for the instance

• `Optional` **root\_device\_name**: `string`

Name assigned to the root device

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/RootDeviceStorage.html

• **root\_device\_type**: [`root_device_type`](../enums/aws_ec2_metadata_entity_instance_metadata.RootDeviceType.md)

Type of root device used by the instance
