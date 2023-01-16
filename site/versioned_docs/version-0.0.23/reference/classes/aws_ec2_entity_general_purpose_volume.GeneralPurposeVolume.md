---
id: "aws_ec2_entity_general_purpose_volume.GeneralPurposeVolume"
title: "Table: general_purpose_volume"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS general purpose Volume entities. Amazon Elastic Block Store (Amazon EBS) provides block
level storage volumes for use with EC2 instances. EBS volumes behave like raw, unformatted block devices.

**`Example`**

```sql TheButton[Create a General purpose volume]="Create a general purpose volume"
INSERT INTO general_purpose_volume (volume_type, availability_zone, size, tags) VALUES ('gp3', 'us-east-1a', 50, '{"Name": "gp3-volume-name"}');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-ec2-gpv-integration.ts#L125
 - https://aws.amazon.com/ebs/general-purpose/

## Columns

• `Optional` **attached\_instance**: [`instance`](aws_ec2_entity_instance.Instance.md)

Reference to the ec2 instances where this volume is attached

• **availability\_zone**: [`availability_zone`](aws_vpc_entity_availability_zone.AvailabilityZone.md)

Reference to the availability zone for the volume

• `Optional` **instance\_device\_name**: `string`

Name for the device when it is attached to an instance

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/device_naming.html

• `Optional` **iops**: `number`

The number of I/O operations per second (IOPS)

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/interfaces/createvolumerequest.html#iops

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
