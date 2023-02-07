# 007 - Pure SQL Modules

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
SELECT iasql_install_third_party('https://github.com/someModuleDeveloper/awsEc2Module');
```

## Proposal

To create a Pure-SQL module, we need a Pure-SQL mapper. I'll continue this RFC with just my proposed solution for having Pure-SQL mappers, since a module is a set of mappers.

First, let's see what we need to create a mapper:
- A cloud id function
- An equality checker function
- An entity, that the mapper manages it
- Cloud CRUD functions
- Ability to call other mappers' CRUD functions

So let's consider this implementation of the above structure (all as Postgres functions):
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

We also need some other things:
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