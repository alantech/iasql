---
sidebar_position: 2
slug: '/install'
---

# Install CLI

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="MacOS" label="MacOS" default>

  Install the IaSQL CLI on MacOS via [Homebrew](https://brew.sh).


  ```bash
  brew install iasql/homebrew-core/iasql
  ```

  </TabItem>
  <TabItem value="Ubuntu" label="Ubuntu">

  Install the IaSQL CLI on Ubuntu via the [published artifacts](https://github.com/iasql/releases/releases). Simply download the `.deb` file and install it with `dpkg`.


  ```bash
  wget https://github.com/iasql/releases/releases/latest/download/iasql_ubuntu_amd64.deb
  sudo dpkg -i iasql_ubuntu_amd64.deb
  ```

  </TabItem>
  <TabItem value="Windows PowerShell" label="Windows PowerShell">

  Install the IaSQL CLI on Windows via the [published artifacts](https://github.com/iasql/releases/releases). Simply download the zip file, and extract the `iasql` executable to somewhere in your `$PATH`.

  ```powershell
  Invoke-WebRequest -OutFile iasql-windows.zip -Uri https://github.com/iasql/releases/releases/latest/download/iasql-windows.zip
  Expand-Archive -Path iasql-windows.zip -DestinationPath C:\windows
  ```

  </TabItem>
</Tabs>