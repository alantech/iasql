---
id: "aws_account_entity.AwsRegions"
title: "aws_regions"
displayed_sidebar: "docs"
sidebar_label: "Reference"
sidebar_position: 0
hide_table_of_contents: true
custom_edit_url: null
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table that will hold all the AWS regions where IaSQL operates.
AWS has the concept of a Region, which is a physical location around the
world where we cluster data centers.

An user can specify which regions are enabled and which region is used as default.

## Columns

• **is\_default**: `boolean`

Identifies the default region. Only one region can be the default one

• **is\_enabled**: `boolean`

Identifies if the region is enabled to interact with IaSQL or not

• **region**: `string`

AWS region
