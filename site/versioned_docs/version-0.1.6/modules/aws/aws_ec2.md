---
id: "aws_ec2"
title: "aws_ec2"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs queryString="view">
  <TabItem value="components" label="Components" default>

### Tables

    [general_purpose_volume](../../aws/tables/aws_ec2_entity_general_purpose_volume.GeneralPurposeVolume)

    [instance](../../aws/tables/aws_ec2_entity_instance.Instance)

    [instance_block_device_mapping](../../aws/tables/aws_ec2_entity_instance_block_device_mapping.InstanceBlockDeviceMapping)

    [key_pair](../../aws/tables/aws_ec2_entity_key_pair.KeyPair)

    [registered_instance](../../aws/tables/aws_ec2_entity_registered_instance.RegisteredInstance)

    [instance_metadata](../../aws/tables/aws_ec2_metadata_entity_instance_metadata.InstanceMetadata)

### Functions
    [describe_ami](../../aws/tables/aws_ec2_rpcs_describe_ami.DescribeAmiRpc)

    [key_pair_import](../../aws/tables/aws_ec2_rpcs_import.KeyPairImportRpc)

    [key_pair_request](../../aws/tables/aws_ec2_rpcs_request.KeyPairRequestRpc)

### Enums
    [general_purpose_volume_type](../../aws/enums/aws_ec2_entity_general_purpose_volume.GeneralPurposeVolumeType)

    [volume_state](../../aws/enums/aws_ec2_entity_general_purpose_volume.VolumeState)

    [state](../../aws/enums/aws_ec2_entity_instance.State)

    [architecture](../../aws/enums/aws_ec2_metadata_entity_instance_metadata.Architecture)

    [root_device_type](../../aws/enums/aws_ec2_metadata_entity_instance_metadata.RootDeviceType)

</TabItem>
  <TabItem value="code-examples" label="Code examples">

```testdoc
modules/aws-ec2-integration.ts#EC2 Integration Testing#Manage EC2 instances
modules/aws-ec2-multi-region.ts#EC2 Integration Testing#Move instance from region
modules/aws-ec2-gpv-integration.ts#EC2 General Purpose Volume Integration Testing#Manage volumes
```

</TabItem>
</Tabs>
