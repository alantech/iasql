---
sidebar_position: 5
slug: '/telemetry'
---

# Telemetry

Telemetry is enabled by default when you run IaSQL locally for us to understand how you use the product and help us improve it. We use the [Posthog](https://posthog.com), which like IaSQL, is open source. If you wish to turn off telemetry you can simply set the `IASQL_TELEMETRY` flag to `off` when [starting](../getting-started.mdx) the docker container.

```bash
docker run -e IASQL_TELEMETRY=off -p 9876:9876 -p 5432:5432 --name iasql iasql/iasql
```

