---
id: "aws_rds"
title: "aws_rds"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs queryString="view">
  <TabItem value="components" label="Components" default>

### Tables

    [db_cluster](../../aws/tables/aws_rds_entity_db_cluster.DBCluster)

    [db_subnet_group](../../aws/tables/aws_rds_entity_db_subnet_group.DBSubnetGroup)

    [parameter_group](../../aws/tables/aws_rds_entity_parameter_group.ParameterGroup)

    [RDS](../../aws/tables/aws_rds_entity_rds.RDS)

### Enums
    [db_cluster_engine](../../aws/enums/aws_rds_entity_db_cluster.dbClusterEngineEnum)

    [parameter_group_family](../../aws/enums/aws_rds_entity_parameter_group.ParameterGroupFamily)

</TabItem>
  <TabItem value="code-examples" label="Code examples">

```testdoc
modules/aws-rds-integration.ts#RDS Integration Testing#Manage RDS instances
modules/aws-rds-cluster-integration.ts#DB Cluster Integration Testing#Manage Multi-AZ clusters
```

</TabItem>
</Tabs>
