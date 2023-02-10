# 007 - Alternative Ways to Create Mappers

## Current Status

### Proposed

2023-02-07

### Accepted

YYYY-MM-DD

#### Approvers

- Full Name <email@example.com>

### Implementation

- [ ] Implemented: [One or more PRs](https://github.com/iasql/iasql-engine/some-pr-link-here) YYYY-MM-DD
- [ ] Revoked/Superceded by: [RFC ###](./000 - RFC Template.md) YYYY-MM-DD

## Author(s)

- Mohammad Teimori Pabandi <m@iasql.com>

## Summary

Having Pure-SQL modules would help us expand more. One key advantage is that we don't need a PR on our engine to add coverage for a new service, we just use a syntax like this and everything JustWorks™.
```postgresql
SELECT iasql_install('https://github.com/someModuleDeveloper/awsEc2Module');
```
That's where we started, but it might be useful to assess different paths we might take for creation of an IaSQL module/mapper.

## Proposal

To create a module, we need a mapper. I'll continue this RFC with my proposed solution for mappers, since a module is a set of mappers, and entities (with a bit of oversimplification).

First, let's see what we need to create a mapper:
- A cloud id function
- An equality checker function
- An entity, that the mapper manages it
- Cloud CRUD functions
- Ability to call other mappers' CRUD functions

We need to get the mapper-like behavior working. I'll explain some ways we might consider for that purpose.

- Remote Mappers
  - Mappers maintained inside IaSQL infrastructure
  - Mappers maintained outside IaSQL infrastructure
- In-IaSQL-Container Mappers
  - Mapper Logic Inside IaSQL Engine
  - Mapper Logic Inside Postgres

### A Stand-Alone Mapper Design (Remote Mappers)

We can run standalone versions of mappers. A standalone mapper means that its logic won't be inside the Postgres, nor in the engine code. But it'll run anywhere outside these two places. Therefore, we need a communication mechanism for this design (which can be something like gRPC, or HTTP as in other places). We also might want to run that standalone mapper on our own server, or on somewhere else. Two approaches:

1. Standalone mappers are served on the IaSQL server: the mapper is submitted to our system, and we'll run it in a container. Then our engine will communicate with that mapper through a communication mechanism. This reduces latency, since the calls will be intra-network, but adds the burden of maintaining the standalone mappers to our side.
![In-house Standalone Mapper](./assets/008/Mapper-1.png)
2. Standalone mappers served on servers other than IaSQL: the mapper providers can host that mapper anywhere, and provide endpoints to the engine which will be called. This keeps the maintenance of the mapper on the mapper developer side, but increases the latency of mapper.
![Self-hosted Standalone Mapper](./assets/008/Mapper-2.png)

In the 2nd way, we should post the AWS credentials to the mapper through the internet, which should be done in a secure way. In both ways I don't see another possible approach than posting the AWS credentials to the mapper, since it needs them to query AWS APIs. Anyway, we should warn people to not use a mapper from untrusted authors, because the credentials will be shared with them.

A positive point for having standalone mappers is that it's language agnostic: mapper developers can write the logic in whatever language they want, and it's fine, until they follow the guidelines for the Engine -> Mapper communication protocol.

One negative point is that they'll be provided with the AWS credentials, and they can perform out-of-band data extraction on it on both of the above ways.

### In-IaSQL-Container Mappers

In this approach, the logic of the mappers will be executed on IaSQL: either on the Postgres server or on the Engine. Our current mappers are under this category.
- Mapper logic is in IaSQL engine: `aws_acm`'s `CertificateMapper`, `aws_ecr`'s `RepositoryImageMapper`, etc.
- Mapper logic is in Postgres server: This is where we initially called Pure-SQL module. Note that `aws_ecs_simplified` module can't be considered under this category, since it introduces no new mappers. It's playing in module-level (not mapper level) and handling a new Entity using already-existing mappers.

Before diving into "Pure-SQL Modules" category, first let's see if our current mappers are surjective to the space of "Mapper logics inside IaSQL engine".

#### Mapper Logic Inside IaSQL Engine

Currently, we're developing our mappers in this category. But there might be other ways to integrate the logic inside the engine, without having to exactly follow our current pattern. I'm getting inspired by [Strapi](https://github.com/strapi/strapi), which is a headless CMS. You can create models using a GUI from Strapi's admin panel and the database will be changed on-air, new API routes will be added with proper logic, and it achieves these without losing performance or being in need of pushing new files to the codebase (but the codebase is changing on-air).

So we can get inspired and create on-air mapper codes. But to ensure safety, we might take one of the two approaches: either by narrowing down the available variables, or the by narrowing down the available functionality.
- Create a sandbox and run mapper's JavaScript code on IaSQL engine: in that sandbox, we can narrow down the context and not pass variables that might cause problems (not sure if that's technically possible currently, but I've found see some links: [1](https://nodejs.org/api/vm.html#vm_vm_runinthiscontext_code_options), [2](https://github.com/patriksimek/vm2)).
  - The only issue that comes to my mind is that we will be vulnerable to SSRF attacks, which can be dangerous [in EC2](https://scalesec.com/blog/exploit-ssrf-to-gain-aws-credentials/). Our other vulnerability to SSRF would be related to the engine's Express server, which will be accessible by the running code. Therefore, we'll need authorization measures for that internal API.
- Providing a new "safe" Domain Specific Language for IaSQL: developers can use this language to create new mappers, and we can translate that to TypeScript code on-air, while narrowing down the DSL interface to something that is "safe" (no code-execution, no unwanted database access, etc). The DSL does not have to be capable of creating all possible mappers (at least not at first) since if they want to do something very professional, they can just submit a PR to the engine.
  - For example: we can supply a base provider like AWS. And using DSL people can dynamically invoke AWS client's methods and write their logic. The DSL then gets parsed and converted to JavaScript code, and we'll use its interface when we need the mapper.


#### Mapper Logic Inside Postgres

We can put the mapper's logic inside Postgres. And then provide an interface for the engine to call mapper functions. In this approach, the interface will be provided through the Postgres, and therefore this is the approach that is most consistent with "Pure-SQL". The DSL idea from the above way can still be applied here (developer writes DSL, PL/pgSQL code is generated).

So let's consider one possible implementation of the mapper structure (all as Postgres functions):
- CloudId: `{entity}_cloud_id(object: json) -> string` a Postgres function that takes the object as json and returns its cloud id as string.
- Equals: `{entity}_equal(o1: json, o2: json) -> boolean`
- CRUD functions:
    - `{entity}_cloud_create(object: json)`
    - `{entity}_cloud_read() -> json list`
    - `{entity}_cloud_update(old: json, new: json)`
    - `{entity}_cloud_delete(object: json)`
- Call other mappers: 
  - `call_mapper('{module_name}', '{entity_name}', 'cloud|db', 'create|read|update|delete', {}::json) -> json`
  - It would be easy to add support for normal modules with the above definition. It will call `ec2_cloud_read` if that Postgres function exists. Otherwise, it'll send an RPC to the engine to ask engine to call that function from the mapper.

We also need some other things for this to work:
- Dynamically creating a module that provides the same interface as `MapperBase`, but calls corresponding SQL functions. 

### Alternatives Considered

I also considered the functions to be strongly-typed inside Postgres. More info here:
https://rounded-apology-58d.notion.site/What-Does-a-Mapper-Need-9402ce7e35244405876f4cf660365c86

## Expected Semver Impact

A minor update. Just adding some Postgres functions, the ability to install a Pure-SQL module from remote link, and the engine having the ability to work with Pure-SQL modules. 

## Affected Components

Mostly the engine

## Expected Timeline

I believe it takes at least 2 weeks for us to create a working example of this and port an easy module to it.