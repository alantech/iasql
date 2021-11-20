---
sidebar_position: 2
slug: '/install'
---

# Install

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="MacOS" label="MacOS" default>

  ```bash
  brew install iasql/homebrew-core/iasql
  ```

  For MacOS it is recommended to install IaSQL via [Homebrew](https://brew.sh).  

  </TabItem>
  <TabItem value="Ubuntu" label="Ubuntu">

  ```bash
  wget https://github.com/iasql/releases/releases/latest/download/iasql-ubuntu.tar.gz
  tar -xzf iasql-ubuntu.tar.gz
  sudo mv iasql /usr/local/bin/iasql
  ```

  For Linux it is recommended to install the IaSQL CLI via the [published artifacts](https://github.com/iasql/releases/releases). Simply download the tar.gz file, and extract the `iasql` executable to somewhere in your `$PATH`, make sure it's marked executable.

  </TabItem>
  <TabItem value="Windows PowerShell" label="Windows PowerShell">

  ```powershell
  Invoke-WebRequest -OutFile iasql-windows.zip -Uri https://github.com/iasql/releases/releases/latest/download/iasql-windows.zip
  Expand-Archive -Path iasql-windows.zip -DestinationPath C:\windows
  ```

  For Windows it is recommended to install the IaSQL CLI via the [published artifacts](https://github.com/iasql/releases/releases). Simply download the zip file, and extract the `iasql` executable to somewhere in your `$PATH`.

  </TabItem>
</Tabs>