---
id: "aws_ec2_entity_instance.Instance"
title: "Table: instance"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS EC2 instances. Amazon Elastic Compute Cloud (Amazon EC2) provides scalable computing capacity
in the Amazon Web Services (AWS) Cloud. You can use Amazon EC2 to launch as many or as few virtual servers
as you need, configure security and networking, and manage storage.

**`Example`**

```sql TheButton[Manage an EC2 instance]="Manage an EC2 instance"
INSERT INTO instance (ami, instance_type, tags, subnet_id)
        SELECT '<internal-ami-id>', 't1.small', '{"name":"test-vm"}', id
        FROM subnet
        WHERE availability_zone = 'us-east-1a'
        LIMIT 1;

UPDATE instance SET role_name = 'role_name' WHERE tags ->> 'name' = 'test-vm';

SELECT * FROM instance WHERE tags ->> 'name' = 'test-vm';

DELETE FROM instance  WHERE tags ->> 'name' = 'test-vm';
```

**`See`**

 - https://github.com/iasql/iasql/blob/main/test/modules/aws-ec2-integration.ts#L219
 - https://aws.amazon.com/ec2/features

## Columns

• **ami**: `string`

Unique identifier for the image to use on the vm.

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AMIs.html

• **hibernation\_enabled**: `boolean`

Specifies if the hibernation mode is enabled for the instance

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Hibernate.html

• `Optional` **instance\_id**: `string`

Internal AWS ID for the instance

• **instance\_type**: `string`

Type of EC2 instance to spin

**`See`**

https://aws.amazon.com/es/ec2/instance-types/

• **key\_pair\_name**: `string`

Name of the keypair to use to SSH into the machine

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html

• **region**: `string`

Region for the instance

• `Optional` **role**: [`iam_role`](aws_iam_entity_role.IamRole.md)

Specific role name used to spin the instance

**`See`**

• **security\_groups**: [`security_group`](aws_security_group_entity.SecurityGroup.md)[]

Reference to the security groups configured for that instance

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html

• **state**: [`state`](../enums/aws_ec2_entity_instance.State.md)

Current state of the EC2 instance

• `Optional` **subnet**: [`subnet`](aws_vpc_entity_subnet.Subnet.md)

Reference to the subnets where this instance is connected

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the instance

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/interfaces/createvolumecommandinput.html#tagspecifications

#### Type definition

▪ [key: `string`]: `string`

• `Optional` **user\_data**: `string`

Text blob containing the specific user data to configure the instance

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html
