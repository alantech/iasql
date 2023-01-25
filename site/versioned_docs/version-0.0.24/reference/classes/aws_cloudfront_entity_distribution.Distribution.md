---
id: "aws_cloudfront_entity_distribution.Distribution"
title: "Table: distribution"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to query for all AWS CloudFront distributions in the system. Amazon CloudFront is a web service that speeds up distribution of your
static and dynamic web content, such as .html, .css, .js, and image files, to your users.

You create a CloudFront distribution to tell CloudFront where you want content to be delivered from, and the details about how to track and manage content delivery.

**`Example`**

```sql TheButton[Manage a CloudFront distribution]="Manage a CloudFront distribution"
 INSERT INTO distribution (caller_reference, comment, enabled, is_ipv6_enabled, default_cache_behavior, origins ) VALUES ('s3-bucket-ref', 'a comment', true, false, "{
TargetOriginId: s3-caller,
ViewerProtocolPolicy: 'allow-all',
CachePolicyId: 'cache-policy-id',
}"", '[
{
  DomainName: `custom-bucket.s3.amazonaws.com`,
  Id: s3OriginId,
  S3OriginConfig: { OriginAccessIdentity: '' },
},
]');

SELECT * FROM distribution WHERE caller_reference='s3-bucket-ref';
DELETE FROM distribution WHERE caller_reference = 's3-bucket-ref';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-cloudfront-integration.ts#L148
 - https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html

## Columns

• `Optional` **caller\_reference**: `string`

An unique value to identify the CloudFront distribution

• `Optional` **comment**: `string`

Internal comments to describe the distribution

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
