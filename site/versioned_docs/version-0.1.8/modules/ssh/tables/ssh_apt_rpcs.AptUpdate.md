---
id: "ssh_apt_rpcs.AptUpdate"
title: "apt_update"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method for updating the apt package list. Creates its own transaction to make sure the
package table is updated when done

Returns the stdout of the process on success, and an error on failure

## Columns
