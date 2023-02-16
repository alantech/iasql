---
id: "aws_cloudfront_entity_distribution.Distribution"
title: "distribution"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to query for all AWS CloudFront distributions in the system. Amazon CloudFront is a web service that speeds up distribution of your
static and dynamic web content, such as .html, .css, .js, and image files, to your users.

You create a CloudFront distribution to tell CloudFront where you want content to be delivered from, and the details about how to track and manage content delivery.

**`See`**

https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html

## Columns

• `Optional` **alternate\_domain\_names**: `string`[]

Add the custom domain names that you use in URLs for the files served by this distribution.
These domain names should be covered by the certificates you've set for this distribution.

• `Optional` **caller\_reference**: `string`

An unique value to identify the CloudFront distribution

• `Optional` **comment**: `string`

Internal comments to describe the distribution

• `Optional` **custom\_ssl\_certificate**: [`certificate`](aws_acm_entity_certificate.Certificate.md)

Associate a certificate from AWS Certificate Manager. The certificate must be in the US East (N. Virginia) Region (us-east-1).

• **default\_cache\_behavior**: `Object`

A complex type that describes the default cache behavior

**`See`**

https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_DefaultCacheBehavior.html

#### Type declaration

| Name | Type |
| :------ | :------ |
| `cache_policy_id` | `undefined` \| `string` |
| `target_origin_id` | `undefined` \| `string` |
| `viewer_protocol_policy` | [`viewer_protocol_policy`](../enums/aws_cloudfront_entity_distribution.viewerProtocolPolicyEnum.md) |

• `Optional` **distribution\_id**: `string`

AWS ID for the CloudFront distribution

• `Optional` **domain\_name**: `string`

Domain name assigned to the distribution by CloudFront

• `Optional` **e\_tag**: `string`

The current version of the distribution's information

• `Optional` **enabled**: `boolean`

Whether the distribution is enabled or not

• `Optional` **is\_ipv6\_enabled**: `boolean`

Whether to enable IPV6 for this distribution

• **origins**: { `custom_origin_config`: `undefined` \| { `http_port`: `undefined` \| `number` ; `https_port`: `undefined` \| `number` ; `origin_protocol_policy`: [`origin_protocol_policy`](../enums/aws_cloudfront_entity_distribution.originProtocolPolicyEnum.md)  } ; `domain_name`: `undefined` \| `string` ; `id`: `undefined` \| `string` ; `origin_shield`: `any` ; `s3_origin_config`: `undefined` \| { `origin_access_identity`: `undefined` \| `string`  }  }[]

A complex type that contains information about origins for this distribution.

**`See`**

https://docs.aws.amazon.com/es_es/cloudfront/latest/APIReference/API_Origins.html

• `Optional` **status**: `string`

The distribution’s status. When the status is Deployed, the distribution’s information is fully propagated to all CloudFront edge locations.

• `Optional` **web\_acl\_id**: `string`

A unique identifier that specifies the WAF web ACL, if any, to associate with this distribution
