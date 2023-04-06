---
id: "aws_iam"
title: "aws_iam"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs queryString="view">
  <TabItem value="components" label="Components" default>

### Tables

    [access_key](../../aws/tables/aws_iam_entity_access_key.AccessKey)

    [iam_role](../../aws/tables/aws_iam_entity_role.IamRole)

    [iam_user](../../aws/tables/aws_iam_entity_user.IamUser)

### Functions
    [access_key_request](../../aws/tables/aws_iam_rpcs_request.AccessKeyRequestRpc)

    [set_user_password_request](../../aws/tables/aws_iam_rpcs_set_password.SetUserPasswordRequestRpc)

### Enums
    [access_key_status](../../aws/enums/aws_iam_entity_access_key.accessKeyStatusEnum)

</TabItem>
  <TabItem value="code-examples" label="Code examples">

```testdoc
modules/aws-iam-integration.ts#IAM Role Integration Testing#Manage Roles
modules/aws-iam-integration.ts#IAM User Integration Testing#Manage Users
```

</TabItem>
</Tabs>
