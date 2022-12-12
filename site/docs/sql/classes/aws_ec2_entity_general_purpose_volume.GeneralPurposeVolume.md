---
id: "aws_ec2_entity_general_purpose_volume.GeneralPurposeVolume"
title: "Table: general_purpose_volume"
sidebar_label: "general_purpose_volume"
custom_edit_url: null
---

Table to manage AWS general purpose Volume entities.

**`Example`**

```sql
INSERT INTO general_purpose_volume (volume_type, availability_zone, size, tags) VALUES ('gp3', 'us-east-1a', 50, '{"Name": "gp3-volume-name"}');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-ec2-gpv-integration.ts#L125
 - https://aws.amazon.com/ebs/general-purpose/

TODO: Revive this, but more safely. Currently breaks `iasql install` if the account has multiple
detached volumes.
@Unique('Unique_gp_instance_device_name', ['instanceDeviceName', 'attachedInstance'])

## Columns

• `Optional` **attached\_instance**: [`instance`](aws_ec2_entity_instance.Instance.md)

Reference to the ec2 instances where this volume is attached

___

• **availability\_zone**: [`availability_zone`](aws_vpc_entity_availability_zone.AvailabilityZone.md)

Reference to the availability zone for the volume

___

• `Optional` **instance\_device\_name**: `string`

Name for the device when it is attached to an instance

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/device_naming.html

___

• `Optional` **iops**: `number`

The number of I/O operations per second (IOPS)

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/interfaces/createvolumerequest.html#iops

___

• **region**: `string`

Region for the volume

___

• **size**: `number`

The size of the volume, in GiBs. You must specify either a snapshot ID or a volume size.

___

• `Optional` **snapshot\_id**: `string`

The snapshot from which to create the volume. You must specify either a snapshot ID or a volume size.

___

• `Optional` **state**: [`volume_state`](../enums/aws_ec2_entity_general_purpose_volume.VolumeState.md)

Current state of the volume

___

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the volume

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/interfaces/createvolumecommandinput.html#tagspecifications

#### Index signature

▪ [key: `string`]: `string`

___

• `Optional` **throughput**: `number`

The throughput to provision for a volume, with a maximum of 1,000 MiB/s. Only valid for gp3 volumes

___

• `Optional` **volume\_id**: `string`

Internal AWS ID for the volume

___

• **volume\_type**: [`general_purpose_volume_type`](../enums/aws_ec2_entity_general_purpose_volume.GeneralPurposeVolumeType.md)

Type of volume
