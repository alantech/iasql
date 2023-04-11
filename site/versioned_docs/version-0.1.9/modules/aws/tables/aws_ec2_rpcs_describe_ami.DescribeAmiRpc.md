---
id: "aws_ec2_rpcs_describe_ami.DescribeAmiRpc"
title: "describe_ami"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method for describing the attributes of a given AMI

Accepts the following values:
- ami id: the ID of the image to query for

Returns following columns:

- attributes: A JSON blob with all the attributes for the given image
- status: OK if the key was created successfully
- message: Error message in case of failure

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/interfaces/describeimagescommandinput.html
