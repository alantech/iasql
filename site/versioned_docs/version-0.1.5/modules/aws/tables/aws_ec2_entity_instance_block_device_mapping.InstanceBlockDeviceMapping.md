---
id: "aws_ec2_entity_instance_block_device_mapping.InstanceBlockDeviceMapping"
title: "instance_block_device_mapping"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS EC2 block device mappings. Each instance that you launch has an associated root device volume,
which is either an Amazon EBS volume or an instance store volume. You can use block device mapping to specify
additional EBS volumes or instance store volumes to attach to an instance when it's launched.

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/block-device-mapping-concepts.html

## Columns

• **delete\_on\_termination**: `boolean`

Indicates whether the EBS volume is deleted on instance termination

• **device\_name**: `string`

Device name to associate this volume to the instance

• **instance**: [`instance`](aws_ec2_entity_instance.Instance.md)

The instance for this volume association

• `Optional` **instance\_id**: `number`

• **region**: `string`

Region for the block device mapping

• `Optional` **volume**: [`general_purpose_volume`](aws_ec2_entity_general_purpose_volume.GeneralPurposeVolume.md)

The volume that is associated with this specific instance

• `Optional` **volume\_id**: `number`
