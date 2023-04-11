---
id: "aws_opensearch_entity_domain.Domain"
title: "domain"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS OpenSearch domains. AWS OpenSearch supports both OpenSearch and ElasticSearch.

**`See`**

https://docs.aws.amazon.com/opensearch-service/latest/developerguide/what-is.html

## Columns

• **access\_policy**: `policy`

IAM Access policy for the cluster

• **auto\_tune**: `boolean`

Auto-tune uses metrics to suggest improvements on opensearch cluster

• **availability\_zone\_count**: `number`

Number of availability zones the opensearch should operate in - between 1 and 3

• `Optional` **cold\_storage**: `boolean`

Enable cold storage to have infrequently-accessed data on a cold disk

• `Optional` **custom\_endpoint**: `string`

Custom endpoint to use for opensearch application

• `Optional` **custom\_endpoint\_certificate**: [`certificate`](aws_acm_entity_certificate.Certificate.md)

ForeignKey to the certificate that will be used with the custom domain

• `Optional` **dedicated\_master\_count**: `number`

How many master instances?

• `Optional` **dedicated\_master\_type**: `open_search_partition_instance_type`

Instance type for master instances

• **domain\_name**: `string`

Name to identify the domain

• `Optional` **ebs\_options**: `ebs_options`

Options for the EBS volume if applicable - e.g. {"Iops": 3000, "EBSEnabled": true, "Throughput": 125, "VolumeSize": 10, "VolumeType": "gp3"}

• **enable\_fine\_grained\_access\_control**: `boolean`

Enable to have fine-grained access control on the cluster

• `Optional` **endpoint**: `string`

Endpoint that can be used to access the opensearch application - comes from the cloud

• `Optional` **fine\_grained\_access\_control\_master\_password**: `string`

Admin password

• `Optional` **fine\_grained\_access\_control\_master\_username**: `string`

Admin username - can't be used together with user ARN

• `Optional` **fine\_grained\_access\_control\_user\_arn**: `string`

Admin user ARN for fine-grained-access control - should not have username and password if this is set

• **instance\_count**: `number`

Number of instances that'll run opensearch. Min: 1 - Max: 80

• **instance\_type**: `open_search_partition_instance_type`

Instance type that is used for opensearch instances

• **region**: `string`

Region for the domain

• `Optional` **security\_groups**: [`security_group`](aws_security_group_entity.SecurityGroup.md)[]

Security groups for opensearch instances

• `Optional` **subnets**: [`subnet`](aws_vpc_entity_subnet.Subnet.md)[]

Subnets that opensearch instances should operate in

• **version**: `string`

Version of the opensearch application - like OpenSearch_2.3

• `Optional` **warm\_instance\_count**: `number`

How many warm instances should opensearch have?

• `Optional` **warm\_instance\_type**: `open_search_warm_partition_instance_type`

Instance type that's used for warm instances
