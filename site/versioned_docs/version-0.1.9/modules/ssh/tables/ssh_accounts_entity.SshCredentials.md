---
id: "ssh_accounts_entity.SshCredentials"
title: "ssh_credentials"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

This table holds ssh credentials for your servers.
Currently only supports public/private key access (where the server already has your public key
to validate responses generated by your private key). This key may optionally be locked by a
passcode, which must also be provided in that case.

## Columns

• **hostname**: `string`

The server hostname, may also be an IP address

• `Optional` **key\_passphrase**: `string`

The passphrase to the private key, if one is present

• **name**: `string`

The name you wish to give to the server. Must be unique for all servers as it is used as a join
column by other server modules to indicate which server the data came from.

• **port**: `number`

The server's ssh port. Defaults to 22

• **private\_key**: `string`

The private key for connecting to the server. Alternate SSH mechanisms not yet available.

• **username**: `string`

The username to connect to the server
