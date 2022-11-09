# 005 - Unsurprising Functions and Scalability RFC

## Current Status

### Proposed

2022-11-04

### Accepted

YYYY-MM-DD

#### Approvers

- Luis Fernando De Pombo <luisfer@iasql.com>
- Alejandro Guillen <alejandro@iasql.com>
- Yolanda Robla <yolanda@iasql.com>
- Mohammad Pabandi <mohammad@iasql.com>

### Implementation

- [ ] Implemented: [One or more PRs](https://github.com/iasql/iasql-engine/some-pr-link-here) YYYY-MM-DD
- [ ] Revoked/Superceded by: [RFC ###](./000 - RFC Template.md) YYYY-MM-DD

## Author(s)

- David Ellis <david@iasql.com>
- Yolanda Robla <yolanda@iasql.com>

## Summary

Because of the transaction-like nature of Postgres connections, if you issue multiple `iasql_*` function calls in series with multiple pure SQL database manipulation statements on a singular connection, the data and schema you expect to be available is not, because all of the IaSQL RPC functions are executed on separate Postgres processes/connections, and the process your connection is on does not get updated with this new data, only new data created within its own connection.

This behavior is normally desired because mutations you trigger during your connection are actually handled by your postgres child process and it prevents changes from outside of your connection from causing weird-to-debug data integrity issues, but our current trick to implement the RPC functions using `dblink` breaks this behavior and makes the results surprising when you're directly connected to the Postgres database.

Furthermore, the current structure to support the RPC calls has set us up with multiple single-points-of-failure that will cause scalability concerns. Solutions for both of these problems independently are large, but considering the two of them together significantly narrows the scope and helps us find a solid path forward for the forseeable future.

## Proposal

### Background

To be more clear on what is going on and why in the RPC function behavior, a description of how the current RPC mechanism works and why it works that way:

1. A user connects to the Postgres database and calls an IaSQL RPC function, like `iasql_install`.
2. This function establishes a `dblink` to the same database, but on a different process, and inserts a new graphile worker job. This is done on a separate process because functions in Postgres are transactional and no other processes can access this inserted data until the function returns, normally. The `dblink` call gets around this by effectively creating a different transaction on a different connection, making it possible for the newly inserted job record to be accessible from other future connections before the original function returns.
3. The function then goes into a loop of polling and sleeping, using `dblink` to re-query the graphile worker job table, waiting for the job to be completed. This allows us to make the RPC function calls blocking, which is a core requirement for our RPC system to maintain.
4. The engine is running a graphile worker process in the `scheduler.ts` file. This is also intermittenly polling the job table using new connections for new jobs to execute. Eventually it finds it and starts executing the work.
5. The job creates _another_ new connection to the database to query the current state of things, in this case deciding what needs to be installed to install the modules requested, and then creating the new schema for the module's tables, and then populating them with data from the user's cloud account, and finally returning the results of what it did back to the job scheduler.
6. The job scheduler writes the results to the graphile worker job table, marking the job as complete (successfully or not).
7. The original function call finally gets a result, parses the JSON and returns one or more records as a virtual table query response. Finally informing the user that the operation is done. But since this process pre-dates all of the other ones mentioned, the new schema and data is _not_ accessible on this process, and any immediate `select` expecting it to be there will fail.

This mutually-polling structure to pass messages back and forth is a bit inefficient (in time, not so bad in actual CPU utilization), but also depends on only a single logical entity mutating the database at a time. If a user establishes two parallel connections to the database and tries to run `iasql_apply` and `iasql_sync` at the same time, they will collide with one another and undo each other's work, so the graphile worker **must** be a single processs, and therefore a single point of failure, in this design.

Further single-points-of-failure abound in the current architecture, as well, with varying degrees of difficulty in dealing with. Besides the graphile worker SPOF, we have:

- The Express server is tightly coupled with the graphile worker, so we can only have one Express server running at a time, as well (unlikely to hit load issues before the scheduler, but still complicates things being tightly coupled)
- The database itself is directly provided to end-users, so it is also a SPOF, with upgrades to it requiring downtime of the entire IaSQL service.
- All of the user databases sit in the same RDS instance, so upgrading Postgres requires upgrading _all_ Postgres instances at the same time, making reversion on failures in that path very expensive.

Choosing a new mechanism to implement the RPC functionality and patching up the SPOFs over time, always being in a deployable state from one patch to the next, is a positive goal, and the path we would be much more likely forced to take if we had significant usage, but as we do not, more "ideal" architectures that we can't find a gradual transition to were also considered, and in the end this is the path recommended. In the alternatives considered, all of the other RPC mechanisms considered are covered, as well as an exploration of how the piecemeal approach hits a dead-end, though the details are sparser there as the specifics depends on the RPC mechanism being transitioned into.

Additionally, there is a problem on the consumption of these functions. When connecting our engine with a client, we rely on an express endpoint, that is deployed on an AWS server and connected via load balancers with some fixed timeout.
This approach is not suitable for communications with a client, basically due to the async nature of our engine. When a request is sent, the engine is processing this on the background, and is returning a response in an unknown amount of time outside of our control, depending on the AWS cloud API calls involved.
This response time can be quite high depending on the queries, and will hit a maximum easily for some queries, either causing failures or not letting the user discover the result of the query.

There needs to be a better way to manage these client calls, to let the server respond in the time it needs, and in a gradual mode, while still letting the user get a relevant and informative answer for the requests.

### Final Proposal

1. The simplest solution to the RPC behavior is to use [`pgbouncer`](https://www.pgbouncer.org/) to only allow one SQL statement per connection and fail out requests that do otherwise. This is a known configuration that every SQL editor we are aware of can handle, as well as several ORMs. This layer on top of the database should [allow us to enable proper SSL certificates](https://www.percona.com/blog/2021/06/28/enabling-ssl-tls-sessions-in-pgbouncer/) to improve trustworthiness with end users and eliminate (most) MITM possibilities.
2. Efficiency gains as well as a reduction in complexity can be had by switching to the [`pgsql-http`](https://github.com/pramsey/pgsql-http) extension and having the RPC functions simply wait for the HTTP response from the engine, though they must _all_ finish before the HTTP connection times out. This requires getting off of RDS, as this [is not one of the blessed extensions](https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-extensions.html). The HTTP timeout issue can be avoided entirely if the engine is a sidecar process to the Postgres instance and they communicate over `localhost`.
3. Take the final few HTTP endpoints exposed to the end users and dashboard in the engine and turn most of them into RPC functions in the `metadata` table, and close off HTTP access to the outer world entirely, exposing only the database. The `/run` endpoint could actually be a [`websocket`](https://en.wikipedia.org/wiki/WebSocket) API, that could wrap something like like [supabase/realtime](https://github.com/supabase/realtime) to better support long-running queries longer-term (after the authentication piece is figured out). The deployment of the WebSocket API would need to rely on [AWS API gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html), instead of just being exposed via an ELB. When using this approach, the result of multiple queries need to be split at the client side, being able to query the WebSocket API with single statements. The results of each query will be updated at real time, letting any client to
   retrieve individual result for each statement as soon as they are produced.
4. Deploy this to a horizontally-scaling collection of EC2 instances with EBS volumes for the database, initially only one such instance, but scaling up to more requires a simple routing layer above that decides the target EC2 instance by the database ID being connected to, with the sharding on the number of logical databases per actual database being determined by the scaling factors we run into.

As follow-on improvements, this singular docker container can also be pushed to Dockerhub and make the deployments even simpler, being just downloading a new docker image, restarting the container, and pruning the dead image(s), with deployments taking seconds rather than minutes, though with a brief moment of downtime (before we implement the routing layer, which could hold external connections open until downstream is up again, then making it zero-downtime).

It would also be possible to consider docker-container-per-user-database (with multiple of them per EC2 instance), which would allow us to drop maintaining multiple module versions at the same time within the engine. `iasql_upgrade` would become an _actual_ upgrade of the engine to a newer version triggered by the end user, instead, but this and the routing layer could be done progressively in the future after the main transition in the four points above.

### Alternatives Considered

There are several categories of solutions for the RPC problem, with sub-solutions within each of them. Each of these solutions can resolve the poor behavior mentioned above, with their own pros and cons.

#### Make changes on original process

These are grouped together as they, through a variety of mechanisms, cause the database changes to be performed on the original connection's process, making the expected side-effects available.

##### Full extension

[There is a solid Rust library for writing Postgres extensions](https://github.com/tcdi/pgx). If we use that we could resolve this by actually executing the changes within the Postgres process.

**Pros:**

- The absolute fastest and least memory consuming approach, with the simplest architecture diagram.

**Cons:**

- Need to rewrite everything in Rust
- Can no longer use RDS as it does not support custom extensions, only a certain collection of "blessed" ones, so we have to rearchitect the entirety of production.

##### Extension with RPC shift and SQL injection

Instead of rewriting everything, we move the RPC logic into the Rust extension, and instead of getting a metadata update on what happened, the actual SQL statements to execute are passed back to the extension to execute.

**Pros:**

- Still pretty fast and we can reuse a lot of existing code.

**Cons:**

- The RPC API has to be reworked again to tackle this.
- We have to "capture" TypeORM's actions to serialize them to the RPC function, which may be complicated (though our context object should help).
- We may have to split more complex RPC calls, like `iasql_install` into a collection of multiple smaller ones, (as querying current module state, generating schema, and then populating said schema progressively alter the database state and capturing SQL output from TypeORM to not write into the database immediately may cause future TypeORM SQL statements to differ from what it _should_ do due to the state staying frozen).

##### RPC with SQL injection only

Instead of moving the RPC logic into an extension, we could just modify the RPC contract to provide SQL to inject through the current graphile worker approach.

**Pros:**

- No need to introduce Rust into the project

**Cons:**

- Probably even slower than the current approach because the SQL statements returned need to be re-parsed and re-executed after they are received
- Consumes _far_ more data in the database as the SQL statements are kept for potentially months until eventually dropped from the job table.
- More likely to need a split of complex RPC calls into multiple sub-calls, as no good way to establish a true socket-like communication channel.

##### Extension attaching a second PSQL socket to process

Instead of recreating the RPC mechanism or emulating it, the IaSQL functions call an extension that does two things:

1. Spin up a random port exposing a second PSQL protocol socket.
2. Calling a REST endpoint on the engine passing the function called and arguments, along with the new socket number.

The extension then polls for:

1. A connection being established on that socket.
2. Executing whatever SQL comes in on that socket (perhaps as simple as passing this off to Postgres' own internals).
3. The connection closing.

Then it disables the socket and simply exits the extension function (the wrapper function that called it does what it wants after that to potentially return metadata results to the caller).

**Pros:**

- The `scheduler` process is no longer necessary, but we still get to re-use the vast majority of our current code.
- No weird injection in TypeORM to capture it's output, just configuring it to talk to a different port than normal.

**Cons:**

- Need to write a Rust extension, and faking the standard postgres connection may be more difficult than expected (it may need to interpret and inject into the main connection)
- Need to expose all ports between the Postgres server and the IaSQL engine, and RDS cannot be used

#### Change Postgres Behavior

##### Switch to MySQL

MySQL may resolve things simply due to its less strict nature. It is not known if we can recreate the current blocking RPC functions, though. But assuming it is possible:

**Pros:**

- MySQL has better real-world scaling than Postgres.

**Cons:**

- MySQL also uses a process-per-connection design, so it may or may not have access to updated data during the run, and the blocking RPC functions (if possible) may still exhibit the same fundamental behavior, even if the functions aren't _explicitly_ emulating a transaction.
- MySQL's DB type system is looser, so several data-correctness enforcements we have in the database would need to be moved into the engine itself, which increases development load for us and reduces immediate feedback on bad INSERTs for users. For instance in MySQL ENUMs accept garbage input and batch it all into a singular bucket instead of failing outright
- MySQL doesn't have an array type, so all uses of arrays currently would need to be converted to JSON (which is not typed at all). This is similar to the first point, but rather than being about weird auto-conversion of bad data into a fixed type and cause unexpected behavior, the bad data stays in its original form and could crash our code, instead.
- Postgres has some types that help us better represent the data we're working with, like the CIDR type, and also allows us to create types to do things better, with the composite types that we can use where it makes sense for the data to be represented in a clearer way to end users.
- MySQL is controlled by one of the more capricious corporations out there: Oracle, the company that sued to make API definitions copyrightable, which would have effectively destroyed software development in the US. So there is some amount of risk building in that ecosystem if we are very successful, as we don't have the legal budget of Google to fend them off.

##### Fork Postgres, make it like MySQL

If we forked postgres itself, we could eliminate the transaction-like behavior of connections and this problem goes away.

**Pros:**

- Solves the issue, [but at what cost?](https://i.kym-cdn.com/entries/icons/mobile/000/032/562/iplcoialdcw31.jpg)

**Cons:**

- Very hard to do in a codebase we are unfamiliar with
- Negatively impacts expected Postgres behavior in all other circumstances

##### Use `pgbouncer` with `statement`-level `pool_mode`

`pgbouncer` is a commonly-used service in conjunction with Postgres to allow thousands of worker processes connect to Postgres without exploding the server with too many child processes. [The `statement`-level in its `pool_mode` configuration](https://www.pgbouncer.org/config.html#pool_mode) bans requests that span more than one statement (and is likely why ArcType and other database clients simply split the requests by statement and issue them separately).

**Pros:**

- "Solves" the issue, by breaking connections that try to do multi-statement at all.

**Cons:**

- "Solves" the issue, by breaking connections that try to do multi-statement at all.

##### Implement a Postgres proxy in the Engine

[Implementing a Postgres proxy is a relatively short blogpost](https://docs.statetrace.com/blog/build-a-postgres-proxy/), so we could implement one in our engine and use the same library we use to split statements in the `/run` endpoint to split statements from the user, execute them on separate connections, and then stitch the results back up to send back to the user. We can also then implement proper SSL support with a certificate even with RDS, as we can do the SSL unwrapping and then connect bare to the RDS instance which we can remove from direct exposure to the 'net.

**Pros:**

- Solves the issue without any changes to existing engine code required.
- Gives us RDS + proper SSL

**Cons:**

- Would cause users expecting the transaction-like behavior in a multi-statement connection without an explicit transaction to not get that behavior. We could potentially minimize this by only breaking up statements when an IaSQL RPC function is detected, but never eliminate it.
- More load on Node.js, and will introduce some extra latency.

#### Why Progressive Improvements to SPOF Issues Hit a Dead-End

In the current architecture, the Postgres database and the Engine are in separate deployments within AWS. This means the communication protocol between them will be over TCP and could fail. There is an interesting [RDS-only extension to invoke Lambda functions from Postgres](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL-Lambda.html) that we could mimic `pgsql-http` with (almost exactly so, if the lambda itself simply queries the http endpoint you provide it), but Lambda functions may only run for 15 minutes before they are terminated, and most HTTP load balancers, ELB included, automatically time out after 1 or 2 minutes, so any request that takes longer (such as spinning up an RDS instance itself) will time out before completion.

This makes it unsuitable as the transport layer for the RPC system, unless some sort of task queue is introduced with unique IDs and the http request triggers the task and then some sort of polling for the task result is performed on the Postgres RPC function side and we have accidentally recreated Graphile Worker, only less powerful and likely with bugs the former doesn't have. Any non-extension approach where we keep RDS runs into this issue, but once we no longer use RDS, we need to run our own EC2 instances with EBS volumes to house the postgres data because you can't trust Fargate/Kubernetes with stateful services like that, and then artificially separating the engine and `pgbouncer` from Postgres induces _higher_ operational complexity, not lower.

However, it is possible to fix the SSL cert issue with the current architecture by spinning up a new Fargate cluster running `pgbouncer` with the SSL cert and then pointing the DNS records at that instead of RDS directly, but that would also require the custom routing layer eventually when we need more than one RDS instance. Not more complex than the proposed solution, but not less complex on that front, and with a slightly higher latency as `pgbouncer` won't be running in the same machine as the RDS instance.

If we decided we wanted to keep Graphile Worker and the complexities surrounding it, we could split the scheduler/graphile-worker process from the Express process into two different deployments, making the Express layer autoscaling and the Scheduler layer could be scaled manually with the number of databases managed and eliminate both SPOFs, but the graphile worker cluster would be finicky and likely introduce significant delays in creating new IaSQL databases to manage, at scale needing to pool new database requests together during some batching window and then redeploying the cluster with the new list of databases hardwired into it for each worker process to select one of them to execute. That as well could potentially be improved with a cluster coordination layer like Apache Zookeeper to allow the workers to register which databases they're in charge of and temporarily "double-up" until the cluster is resized, but that introduces much more operational complexity and possible points-of-failure (even if not singular points of failure).

On top of all of that, this direction causes our production and staging environments to become further and further removed from our local and test environments, which increases the maintenance burden and makes the likelihood of bugs getting through higher, as developer testing of certain paths differs more from user usage.

The piecemeal approach to scalability would guide us to a much more complex production environment with worse latencies and a harder-to-manage codebase, and that is why it has been rejected (while we still can).

## Expected Semver Impact

This would be considered a major version bump as the spin-up of new databases will change, as well as how it is deployed in every environment, but if considering only the user experience _after_ the database exists, it would just be a patch bump, as it is simply fixing a bug in the RPC functions.

## Affected Components

- The scheduler is dropped, `pgsql-http` replaces it
- `docker-compose.yml` is dropped, a new singular `Dockerfile` replaces it
- `pgbouncer` becomes a hard dependency
- The `metadata` database gains RPC support, all external Express endpoints become `metadata` RPC calls except `/run` which becomes a Lambda for the Dashboard
- Production and Staging deployment rewritten

## Expected Timeline

Despite the size of the above, the initial branch (ignoring the staging/production deployment piece) should be doable in 1-3 days, as lots of complexity is dropped in favor of a simpler way of doing things. Getting staging and then production into this form is what will take the most time, probably 2-5 days.
