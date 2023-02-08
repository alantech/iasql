---
id: "aws_iam"
title: "aws_iam"
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

    [access_key](../../classes/aws_iam_entity_access_key.AccessKey)

    [iam_role](../../classes/aws_iam_entity_role.IamRole)

    [iam_user](../../classes/aws_iam_entity_user.IamUser)

### Functions
    [access_key_request](../../classes/aws_iam_rpcs_request.AccessKeyRequestRpc)

    [set_user_password_request](../../classes/aws_iam_rpcs_set_password.SetUserPasswordRequestRpc)

### Enums
    [access_key_status](../../enums/aws_iam_entity_access_key.accessKeyStatusEnum)

</TabItem>
  <TabItem value="Code examples" label="Code examples">

```testdoc
modules/aws-iam-integration.ts#IAM Role Integration Testing#Manage Roles
modules/aws-iam-integration.ts#IAM User Integration Testing#Manage Users
```

</TabItem>
</Tabs>
