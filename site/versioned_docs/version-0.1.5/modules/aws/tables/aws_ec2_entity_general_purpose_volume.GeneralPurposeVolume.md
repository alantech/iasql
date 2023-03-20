---
id: "aws_ec2_entity_general_purpose_volume.GeneralPurposeVolume"
title: "general_purpose_volume"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS general purpose Volume entities. Amazon Elastic Block Store (Amazon EBS) provides block
level storage volumes for use with EC2 instances. EBS volumes behave like raw, unformatted block devices.

**`See`**

https://aws.amazon.com/ebs/general-purpose/

## Columns

• **availability\_zone**: [`availability_zone`](aws_vpc_entity_availability_zone.AvailabilityZone.md)

Reference to the availability zone for the volume

• `Optional` **instance\_block\_device\_mappings**: [`instance_block_device_mapping`](aws_ec2_entity_instance_block_device_mapping.InstanceBlockDeviceMapping.md)[]

Block device mappings for the instance

• `Optional` **iops**: `number`

The number of I/O operations per second (IOPS)

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/interfaces/createvolumerequest.html#iops

• `Optional` **is\_root\_device**: `boolean`

If set to true it will not be created and used only for defining initial EBS on instance creation

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/block-device-mapping-concepts.html

• **region**: `string`

Region for the volume

• **size**: `number`

The size of the volume, in GiBs. You must specify either a snapshot ID or a volume size.

• `Optional` **snapshot\_id**: `string`

The snapshot from which to create the volume. You must specify either a snapshot ID or a volume size.

• `Optional` **state**: [`volume_state`](../enums/aws_ec2_entity_general_purpose_volume.VolumeState.md)

Current state of the volume

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the volume

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/interfaces/createvolumecommandinput.html#tagspecifications

#### Type definition

▪ [key: `string`]: `string`

• `Optional` **throughput**: `number`

The throughput to provision for a volume, with a maximum of 1,000 MiB/s. Only valid for gp3 volumes

• `Optional` **volume\_id**: `string`

AWS generated ID for the volume

• **volume\_type**: [`general_purpose_volume_type`](../enums/aws_ec2_entity_general_purpose_volume.GeneralPurposeVolumeType.md)

Type of volume
