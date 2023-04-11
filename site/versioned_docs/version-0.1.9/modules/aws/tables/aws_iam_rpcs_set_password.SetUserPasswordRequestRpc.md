---
id: "aws_iam_rpcs_set_password.SetUserPasswordRequestRpc"
title: "set_user_password_request"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method for requesting a new password for an IAM user

Accepts the following parameters:

- username: the name of the IAM user to manage
- password: the new password to set for the user. If password is set to blank it will delete the current password
- reset_password: a value of 'true' will require the user to update the password in the next login

Returns following columns:

- status: OK if the password was updated successfully
- message: Error message in case of failure

**`See`**

 - https://docs.aws.amazon.com/cli/latest/reference/iam/create-login-profile.html
 - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_passwords_account-policy.html
