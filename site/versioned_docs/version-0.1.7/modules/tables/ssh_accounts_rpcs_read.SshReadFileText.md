---
id: "ssh_accounts_rpcs_read.SshReadFileText"
title: "ssh_read_file_text"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method for reading one or more text files on a remote server

After the server name is provided, all remaining columns are treated as fully-qualified
file paths to read

Returns the following columns:

- path: The fully-qualified file path for the file in question

- data: The text contents of the file in question

## Columns
