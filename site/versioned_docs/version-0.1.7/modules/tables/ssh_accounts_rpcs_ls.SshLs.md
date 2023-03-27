---
id: "ssh_accounts_rpcs_ls.SshLs"
title: "ssh_ls"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method for listing the contents of a directory on a remote server

Returns the following columns:

- filename: The name of the file in question

- permissions: A text representation of file permissions

- link_count: The number of hard links on the file system for the file in question

- owner_name: The server user that owns the file

- group_name: The server group that has access to the file

- size_bytes: The size of the file in bytes

- attrs: A JSON blob of various attributes, with overlap of the prior columns

## Columns
