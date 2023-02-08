---
id: "aws_ec2"
title: "aws_ec2"
displayed_sidebar: "docs"
sidebar_label: "Reference"
sidebar_position: 0
hide_table_of_contents: true
custom_edit_url: null
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="Components" label="Components" default>

### Tables

    [general_purpose_volume](../../classes/aws_ec2_entity_general_purpose_volume.GeneralPurposeVolume)

    [instance](../../classes/aws_ec2_entity_instance.Instance)

    [key_pair](../../classes/aws_ec2_entity_key_pair.KeyPair)

    [registered_instance](../../classes/aws_ec2_entity_registered_instance.RegisteredInstance)

    [instance_metadata](../../classes/aws_ec2_metadata_entity_instance_metadata.InstanceMetadata)

### Functions
    [key_pair_import](../../classes/aws_ec2_rpcs_import.KeyPairImportRpc)

    [key_pair_request](../../classes/aws_ec2_rpcs_request.KeyPairRequestRpc)

### Enums
    [general_purpose_volume_type](../../enums/aws_ec2_entity_general_purpose_volume.GeneralPurposeVolumeType)

    [volume_state](../../enums/aws_ec2_entity_general_purpose_volume.VolumeState)

    [state](../../enums/aws_ec2_entity_instance.State)

    [architecture](../../enums/aws_ec2_metadata_entity_instance_metadata.Architecture)

    [root_device_type](../../enums/aws_ec2_metadata_entity_instance_metadata.RootDeviceType)

</TabItem>
  <TabItem value="Code examples" label="Code examples">

```testdoc
modules/aws-ec2-integration.ts#EC2 Integration Testing#Manage EC2 instances
modules/aws-ec2-gpv-integration.ts#EC2 General Purpose Volume Integration Testing#Manage volumes
```

</TabItem>
</Tabs>
