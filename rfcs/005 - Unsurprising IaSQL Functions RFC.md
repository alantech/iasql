# 005 - Unsurprising IaSQL Functions RFC

## Current Status

### Proposed

2022-10-30

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

## Summary

Because of the transaction-like nature of Postgres connections, if you issue multiple `iasql_*` function calls in series with multiple pure SQL database manipulation statements on a singular connection, the data and schema you expect to be available is not, because all of the IaSQL RPC functions are executed on separate Postgres processes/connections, and the process your connection is on does not get updated with this new data, only new data created within its own connection.

This behavior is normally desired because mutations you trigger during your connection are actually handled by your postgres child process and it prevents changes from outside of your connection from causing weird-to-debug data integrity issues, but our current trick to implement the RPC functions using `dblink` breaks this behavior and makes the results surprising when you're directly connected to the Postgres database.

## Proposal

There are multiple potential fixes, not all of them are mutually exclusive, and they have differing performance and disk usage implications, so before a final proposal is put forward, all of the alternatives we can think of are.

To be more clear on what is going on and why, a description of how the current RPC mechanism works and why it works that way:

1. A user connects to the Postgres database and calls an IaSQL RPC function, like `iasql_install`.
2. This function establishes a `dblink` to the same database, but on a different process, and inserts a new graphile worker job. This is done on a separate process because functions in Postgres are transactional and no other processes can access this inserted data until the function returns, normally. The `dblink` call gets around this by effectively creating a different transaction on a different connection, making it possible for the newly inserted job record to be accessible from other future connections before the original function returns.
3. The function then goes into a loop of polling and sleeping, using `dblink` to re-query the graphile worker job table, waiting for the job to be completed. This allows us to make the RPC function calls blocking.
4. The engine is running a graphile worker process in the `scheduler.ts` file. This is also intermittenly polling the job table using new connections for new jobs to execute. Eventually it finds it and starts executing the work.
5. The job creates *another* new connection to the database to query the current state of things, in this case deciding what needs to be installed to install the modules requested, and then creating the new schema for the module's tables, and then populating them with data from the user's cloud account, and finally returning the results of what it did back to the job scheduler.
6. The job scheduler writes the results to the graphile worker job table, marking the job as complete (successfully or not).
7. The original function call finally gets a result, parses the JSON and returns one or more records as a virtual table query response. Finally informing the user that the operation is done. But since this process pre-dates all of the other ones mentioned, the new schema and data is *not* accessible on this process, and any immediate `select` expecting it to be there will fail.

### Alternatives Considered

There are several categories of solutions, with sub-solutions within each of them. Each of these solutions can resolve the poor behavior mentioned above, with their own pros and cons.

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
- We may have to split more complex RPC calls, like `iasql_install` into a collection of multiple smaller ones, (as querying current module state, generating schema, and then populating said schema progressively alter the database state and capturing SQL output from TypeORM to not write into the database immediately may cause future TypeORM SQL statements to differ from what it *should* do due to the state staying frozen).

##### RPC with SQL injection only

Instead of moving the RPC logic into an extension, we could just modify the RPC contract to provide SQL to inject through the current graphile worker approach.

**Pros:**

- No need to introduce Rust into the project

**Cons:**

- Probably even slower than the current approach because the SQL statements returned need to be re-parsed and re-executed after they are received
- Consumes *far* more data in the database as the SQL statements are kept for potentially months until eventually dropped from the job table.
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

## Expected Semver Impact

This would be considered a patch as it is fixing a current bug in the RPC functions.

## Affected Components

A brief listing of what part(s) of the engine will be impacted should be written here.

## Expected Timeline

An RFC proposal should define the set of work that needs to be done, in what order, and with an expected level of effort and turnaround time necessary. *No* multi-stage work proposal should leave the engine in a non-functioning state.
