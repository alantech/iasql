# 001 - EC2 Schema

## Current Status

### Proposed

2022-07-18

### Accepted

YYYY-MM-DD

#### Approvers

- LuisFer De Pombo <luisfer@iasql.com>
- David Ellis <david@alantechnologies.com>

### Implementation

- [ ] Implemented: [One or more PRs](https://github.com/iasql/iasql-engine/some-pr-link-here) YYYY-MM-DD
- [ ] Revoked/Superceded by: [RFC ###](./000 - RFC Template.md) YYYY-MM-DD

## Author(s)

- Alejandro Guillen <alejandro@iasql.com>

## Summary

Adding new features to get closer to the goal of the EC2 module's completeness adds more complexity to the model. This complexity directly affects the user experience, especially for new users, since they can feel overwhelmed if they encounter a complicated model.

The definition of a solid base now will imply that new features added to this module will not translate into breaking changes to the model.

Taking a look at the AWS EC2 console options, we would still need to add the following to reach EC2 module completeness:

- Instance type - Availability zone relationship
- Launch templates
- Spot instances
- Dedicated hosts
- Saving plans
- Reserved instances
- Scheduled instances
- Capacity reservations
- Auto Scaling Groups
- AMIs management
- EBS volume snapshots and life cycle
- Elastic IP integration
- Placement groups
- Network interfaces

Almost all the features listed will need a direct integration with the `instance` table, needing to add at least eight more columns to the model. Those columns are only for integration, but the `instance` model still needs more properties to be defined to be complete. Some of those missing properties are: instance auto-recovery, shutdown behaviour, stop - hibernate behaviour, termination protection, stop protection, detailed cloudWatch monitoring, elastic GPU, credit specification, tenancy, RAM disk ID, kernel ID or Metadata accessible (I might be missing others).

The current instance module has ten columns. Adding the ones representing integration with other features will almost double its size.

## Proposal

The `instance` table is the core of the `aws_ec2` module and is the one that can grow more in complexity. The proposal is to keep adding the necessary columns to the `instance` table. It is better to have a unique table to look for instances than increase the complexity of the model, creating other tables and adding to the users the need to understand our model first. Eventually, we can add an `aws_ec2_simplified` module that can expose the basics to create an instance and leave the `aws_ec2` for advanced users.

We can divide the feature list as follow:

The direct implication in the `instance` table:

- Launch templates
- Spot instances
- Dedicated hosts
- Capacity reservations
- Auto Scaling Groups
- Elastic IP integration
- Placement groups
- Network interfaces

No implicaiton in the `instance` table:

- Instance type - Availability zone relationship
- AMIs management
- EBS volume snapshots and life cycle

The `Saving plans`, `Reserved instances` or `Scheduled instances` are not included in the list above since they seem to be budgeting solutions that need interaction with the user rather than infrastructure-related modules' features that could have any implication in the model.

Let's start with the features without impact on the `instance` table. These features will be part of the `aws_ec2` module with their mappers. The Instance type table by availability zones will be a table with a composite primary key. It technically has a minimum impact in the `instance` table that will be a special FK to the composite primary key, but no UX model impact.

The features with direct implications in the `instance` table can be divided into two groups: one group affects only the `aws_ec2` module, the other impacts more modules.

Let's start with the first group, Placement groups and Network interfaces. These features will be part of their respective modules (probably `aws_vpc`?). Then, they will need to be integrated with the `instance` table in the `aws_ec2` module with an FK nullable column.

The rest of the features will need to be implemented in the `aws_ec2` module and integrated with the `instance` table in the `aws_ec2` module with an FK nullable column.

Spot instances and Auto Scaling Group can be updated at any point in time by the cloud. These will imply the development of the "safer sync faster apply" feature as a pre-requisite for the two.

Launch templates, auto-scaling group requests and spot instances requests can be linked to an instance using the tags AWS assign with a specific pattern. Otherwise will be hard to link all the relationships due to the async nature of ASG and spot instances.

### Alternatives Considered

Create different modules for the services that can manage AWS instances.
Create different tables within the same `aws_ec2` module for the services that can manage AWS instances.
These two were discarded since they will increase the complexity of the model. Users will need to find all the tables that can contain `instance` information.

Add iasql module's capabilities.
This option is not viable since it will be really hard to maintain and make it compatible through versions. It will imply the need for several opinionated decisions in behaviour that could not be expected by the users. Also, new users may not understand what capabilities are and add all of them every time.

## Expected Semver Impact

Patch version

## Affected Components

`aws_ec2` module

## Expected Timeline

TBD
