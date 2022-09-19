---
sidebar_position: 2
slug: '/connect'
---

# Connecting to PostgreSQL

The IaSQL [dashboard](https://app.iasql.com) provides an IDE-like SQL editor built specifically for the IaSQL needs that can be used to run queries on the hosted database(s) connected to your cloud account(s).

<img width={440} src={require('@site/static/screenshots/dashboard.png').default} />

It is also possible to connect to a hosted IaSQL PostgreSQL database outside of the dashboard. The required information to connect to a PostgreSQL IaSQL database will be provided when you connect an AWS account when provisioning the database. IaSQL does not store your database password so it will only be displayed when the database is provisioned. If you lose the password, you can recreate the database by disconnecting and connecting your account again using the same region and AWS credentials.

<img width={440} src={require('@site/static/screenshots/credentials.png').default} />

## PostgreSQL Clients

PostgreSQL has a built-in command line client, `psql`, which you can use to connect to your database and run queries. To install `psql` in your command line follow the instructions for your corresponding OS [here](https://www.postgresql.org/download/).

One of the reasons we built IaSQL on an unmodified PG is because of the vast ecosystem we get to stand on. This [PostgreSQL Client wiki](https://wiki.postgresql.org/wiki/PostgreSQL_Clients) contains an extensive list of all the different clients you can use to connect to a PG database provisioned with IaSQL. The IaSQL team personally uses and recommends [Arctype](https://arctype.com) and [Beekeeper Studio](https://www.beekeeperstudio.io).