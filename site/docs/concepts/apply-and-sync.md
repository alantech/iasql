---
sidebar_position: 3
slug: '/apply-and-sync'
---

# `apply` and `sync` at a High Level

The most basic architectural diagram is simply your IaSQL database and your cloud account with the `iasql-engine` in between.

```
   ______
  /      \       _______            __
  |\____/|      |       |       ___/  \__
  |  DB  | <==> | IaSQL | <==> /  Cloud  \
  |      |      |_______|      \_    _   /
  \______/                       \__/ \_/
```

## `apply` and `preview_apply`

When you `apply` you take any changes from the database, feed them into the engine, and then it creates the necessary API calls on the cloud to make those changes to the cloud. `preview_apply` is a dry-run of `apply` that shows you what would happen if you ran `apply`.

```
   ______
  /      \       _______            __
  |\____/|      |       |       ___/  \__
  |  DB  | ===> | IaSQL | ===> /  Cloud  \
  |      |      |_______|      \_    _   /
  \______/                       \__/ \_/
```

## `sync` and `preview_sync`

When you `sync` you take any changes from the cloud, convert them into database records, and update the database with the new information. `preview_sync` is a dry-run of `sync` that shows you what would happen if you ran `sync`.

```
   ______
  /      \       _______            __
  |\____/|      |       |       ___/  \__
  |  DB  | <=== | IaSQL | <=== /  Cloud  \
  |      |      |_______|      \_    _   /
  \______/                       \__/ \_/
```


In both cases, though, the engine needs to be aware of what already exists on the other side in order to make only the calls necessary to produce the desired mutation on the other side.

Traditional IaC tools like Terraform use an internal statefile for this purpose, but this is folly. If there is ever an unexpected change, such as from an outage (or the manual mitigation of an outage) this statefile will not represent the other side correctly so the mutations it attempts will be incorrect causing the change to fail.

IaSQL's engine, on the other hand, is completely stateless. It acquires the state of both the database and the cloud when asked to perform a change in either direction and then determines the work it will do based on the *true state* of both.

This is done in an eventually consistent Read-Diff-Execute loop. Read more about how it is implemented in our [contributing documentation](https://github.com/iasql/iasql-engine/blob/main/CONTRIBUTING.md#apply-and-sync-behavior).