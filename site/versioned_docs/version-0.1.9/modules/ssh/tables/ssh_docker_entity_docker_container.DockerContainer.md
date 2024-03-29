---
id: "ssh_docker_entity_docker_container.DockerContainer"
title: "docker_container"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage docker containers
You can manage docker containers on your hosts that are registered in ssh_accounts module

## Columns

• `Optional` **binds**: `string`[]

A list of container's bind mounts - for example {'/home/my-app:/app'}

• `Optional` **command**: `string`[]

CMD of the docker container

• `Optional` **container\_id**: `string`

Id that docker engine has assigned to this container

• `Optional` **created**: `date`

Creation date of the docker container

• `Optional` **entrypoint**: `string`[]

Entrypoint of the docker container

• `Optional` **env**: `string`[]

Environment variables as a list, in form of {'A=B', 'C=D'}

• **image**: `string`

Image of the docker container - eg. ubuntu, iasql/iasql:latest

• `Optional` **labels**: `Object`

Labels for the docker container - for example {'l1': 'l1-value', 'l2': 'l2-value'}

#### Type definition

▪ [label: `string`]: `string`

• `Optional` **mounts**: `mount_config`

Mount config for the volumes

• `Optional` **name**: `string`

Name of the docker container - either set by user or auto-generated by docker engine

• `Optional` **ports**: `Object`

Port binding of the docker container to the host, for example {'80/tcp': [{HostIp: '', HostPort: '81'}]}

#### Type definition

▪ [port_and_protocol: `string`]: { `host_ip`: `string` ; `host_port`: `string`  }[]

• **server\_name**: `string`

Server name that is inserted into ssh_credentials table

• `Optional` **state**: `string`

State of the docker container - it can be used to start/stop/pause/unpause the container

• `Optional` **volumes**: `string`[]

Volume definition of the docker container - for example {'vol-name1', 'vol-name2'}
