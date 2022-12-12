---
id: "aws_account_entity.AwsRegions"
title: "Table: aws_regions"
sidebar_label: "aws_regions"
custom_edit_url: null
---

Table that will hold all the AWS regions where IaSQL operates. User can specify
which regions are enabled and which region is used as default.

**`Example`**

```sql
 SELECT * FROM aws_regions WHERE is_default = TRUE;
 UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
```

**`See`**

 - https://aws.amazon.com/about-aws/global-infrastructure/regions_az/
 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-account-integration.ts#L185
 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-account-integration.ts#L196

## Columns

• **is\_default**: `boolean`

Identifies the default region. Only one region can be the default one

___

• **is\_enabled**: `boolean`

Identifies if the region is enabled to interact with IaSQL or not

___

• **region**: `string`

**`Param`**

region
