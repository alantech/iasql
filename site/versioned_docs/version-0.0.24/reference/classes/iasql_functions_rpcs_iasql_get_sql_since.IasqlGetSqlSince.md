---
id: "iasql_functions_rpcs_iasql_get_sql_since.IasqlGetSqlSince"
title: "Method: iasql_get_sql_since"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Method that generates SQL from the audit log from a given point in time.

**`Example`**

```sql
SELECT * FROM iasql_get_sql_since();
SELECT * FROM iasql_get_sql_since('2023-01-05T12:00:00');
SELECT * FROM iasql_get_sql_since((now() - interval '5 minutes')::text);
```

## Columns
