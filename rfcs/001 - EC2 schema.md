# 001 - EC2 Schema

## Current Status

### Proposed

2022-07-18

### Accepted

YYYY-MM-DD

#### Approvers

- LuisFer De Pombo <luisfer@iasql.com>
- David Ellis <david@alantechnologies.com>
- Yolanda Robla <yolanda@iasql.com>

### Implementation

- [ ] Implemented: [One or more PRs](https://github.com/iasql/iasql-engine/some-pr-link-here) YYYY-MM-DD
- [ ] Revoked/Superceded by: [RFC ###](./000 - RFC Template.md) YYYY-MM-DD

## Author(s)

- Alejandro Guillen <alejandro@iasql.com>

<!-- TODO: WIP -->
## Summary

Adding new features to get closer to the goal of the EC2 module's completeness adds more complexity to the model. This complexity directly affects the user experience, especially for new users, since they can feel overwhelmed if they encounter a complicated model.

The definition of a solid base now will imply that new features added to this module will not translate into breaking changes to the model.

Taking a look at the AWS EC2 console options, we would still need to add the following to reach EC2 module completeness:

<!-- TODO: IMAGE -->

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

<!-- TODO: add current model -->

<!-- TODO: WIP -->
## Proposal

- Creating an intance using the UI/API let you add some advance configuration, that usually is not used, but is there. Shing an screenshot of part of it, but this would mean adding at least 12 columns (instance auto-recovery, shutdown behaviour, stop - hibernate behaviour, termination protection, stop protection, detailed cloudWatch monitoring, elastic GPU, credit specification, tenancy, RAM disk ID, kernel ID or Metadata accessible).
<!-- TODO: add new columns image -->

- Add `availability_zone` column to `instance` table to be able to have an `instance_type` table by availability zones using composite keys.

- Launch templates will be a new table and need to be an `instance` table input column `launch_template_id`. If we insert other values to the `instance`, these ones will override the launch template. To be able to know if an instance was created using one of them we check the tags and look for the id to link them.

- Spot requests can be created manually, using launch templates or can be created by other entities like ASG. If an instance was created using an spot request should not affect the `instance` table, so the relation between them will be part of the `instance_metadata`. To be able to know if an instance was created by an spot request we check the tags and look for the id to link them.

- Dedicated host. physical servers fully dedicated by instance type and availability zone. The instance table will have a FK to this table.

- Scheduled instances. Another marketplace like serivce. A desired schedule need to be set and then based on that you can se the offering that you can buy.

- Capacity reservations. reservation of an instance type per availability zone. Once defiend could be use by any instance using the fk column, or if the cr is assigned automatically, we need to use the tags in the instance and add the right FK value.

- EBS Snapshots. Can be created from an instance or from a volume. FK to both tables.

- Lifecycles: work with tags. could be related to instance or volumes but are for data retention. It will go to instance metadata.

- Placement groups. Strategies to launch instances

- Key Pairs: Create them, FK column already in instance table

- Network interfaces. Logical network components. A ENI belongs to an instance, but an instance can have multiple ENIs. (similar to ebs)

- Auto Scaling Groups can be created manually, using launch templates (and launch configurations that are like launch templates just for ASG?) or can be created by other entities like EKS. Like spot requests, ASGs should not have direct relation with instances and can be part of the `instance_metadata`. To be able to know if an instance was created by an ASG we check the tags and look for the id to link them.

- AMIs can be own by someone, you can check for yours or others. Private or public. should be their own module.

- Saving plans. Budget solution. Is not related only to EC2, but Fargate and Lambda too. Commitment to a consistent amount of usage (measured in $/hour) for a 1 or 3 year term. The flow is similar to a marketplace. Maybe need its own module? I do not forseen direct relation with any entity of the aws_ec2 module. It appears under ec2 but seems to be part of the AWS Cost management service.

<!-- TODO: INSERT IMAGE HERE -->

- Reserved instances. Budget solution. Supply and demand model. CHnage often. It is like parking space.

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

No implication in the `instance` table:

- Instance type - Availability zone relationship
- AMIs management
- EBS volume snapshots and life cycle

The `Saving plans`, `Reserved instances` or `Scheduled instances` are not included in the list above since they seem to be budgeting solutions that need interaction with the user rather than infrastructure-related modules' features that could have any implication in the model.

Let's start with the features without impact on the `instance` table. These features will be part of the `aws_ec2` module with their mappers. The Instance type table by availability zones will be a table with a composite primary key. It technically has a minimum impact in the `instance` table that will be a special FK to the composite primary key, but no UX model impact.

The features with direct implications in the `instance` table can be divided into two groups: one group affects only the `aws_ec2` module, the other impacts more modules.

Let's start with the first group, Placement groups and Network interfaces. These features will be part of their respective modules (probably `aws_vpc`?). Then, they will need to be integrated with the `instance` table in the `aws_ec2` module with an FK nullable column.

The rest of the features will need to be implemented in the `aws_ec2` module and integrated with the `instance` table in the `aws_ec2` module with an FK nullable column.

Spot instances and Auto Scaling Group can be updated at any point in time by the cloud. These will imply the development of the "safer sync faster apply" feature as a pre-requisite for the two.

We will have FK columns for Launch Templates, Spot Requests and Auto Scaling Groups, but the information retrieved from the instance does not provide direct fields to know if it belongs to any of them or how to relate them. One option for Spot fleets or ASGs is that every time we look for instance information, we call ASG or Spot fleet APIs to get the instances and look for the one we are interested in. This solution will lead to bad performance at scale. Alternatively, AWS adds special tags to the instances created using any Launch template, Spot fleet request and/or ASG. We might need to trust these tags and use them to add the correct field in the FK column.

### Alternatives Considered

- Create different modules for the services that can manage AWS instances.
- Create different tables within the same `aws_ec2` module for the services that can manage AWS instances.

These two were discarded since they will increase the complexity of the model. Users will need to find all the tables that can contain `instance` information.

- Let iasql modules dynamically add/remove tables/columns based on module's "capabilities" selected by the user.

This option is not viable since it will be really hard to maintain and make it compatible through versions. It will imply the need for several opinionated decisions in behaviour that could not be expected by the users. Also, new users may not understand what capabilities are and add all of them every time.

## Expected Semver Impact

<!-- TODO -->
Patch version

## Affected Components

- `aws_ec2` module
- `aws_ec2_metadata` module
- `aws_vpc` module

## Expected Timeline

<!-- TODO -->
