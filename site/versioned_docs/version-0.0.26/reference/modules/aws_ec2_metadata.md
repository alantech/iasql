---
id: "aws_ec2_metadata"
title: "aws_ec2_metadata"
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

    [instance_metadata](../../classes/aws_ec2_metadata_entity_instance_metadata.InstanceMetadata)

### Enums
    [architecture](../../enums/aws_ec2_metadata_entity_instance_metadata.Architecture)

    [root_device_type](../../enums/aws_ec2_metadata_entity_instance_metadata.RootDeviceType)

</TabItem>
  <TabItem value="Code examples" label="Code examples">

## Code examples

### Read-only instance metadata

Install the AWS EC2 module

```sql
SELECT * FROM iasql_install('aws_ec2_metadata');
```

View the metadata for the previously created `i-1` instance. View the table schema [here](https://dbdocs.io/iasql/iasql?table=instance_metadata&schema=public&view=table_structure)

```sql
SELECT *
FROM instance_metadata
WHERE instance_id = (
SELECT instance_id
FROM instance
WHERE tags ->> 'name' = 'i-1'
);
```

</TabItem>
</Tabs>
