---
id: "aws_cloudfront_entity_distribution.Distribution"
title: "Table: distribution"
sidebar_label: "distribution"
custom_edit_url: null
---

Table to query for all AWS CloudFront distributions in the system.

**`Example`**

```sql
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

___

• `Optional` **comment**: `string`

Internal comments to describe the distribution

___

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

___

• `Optional` **distribution\_id**: `string`

AWS ID for the CloudFront distribution

___

• `Optional` **e\_tag**: `string`

The current version of the distribution's information

___

• `Optional` **enabled**: `boolean`

Wether the distribution is enabled or not

___

• `Optional` **is\_ipv6\_enabled**: `boolean`

Wether to enable IPV6 for this distribution

___

• **origins**: { `custom_origin_config`: `undefined` \| { `http_port`: `undefined` \| `number` ; `https_port`: `undefined` \| `number` ; `origin_protocol_policy`: [`origin_protocol_policy`](../enums/aws_cloudfront_entity_distribution.originProtocolPolicyEnum.md)  } ; `domain_name`: `undefined` \| `string` ; `id`: `undefined` \| `string` ; `origin_shield`: `any` ; `s3_origin_config`: `undefined` \| { `origin_access_identity`: `undefined` \| `string`  }  }[]

A complex type that contains information about origins for this distribution.

**`See`**

https://docs.aws.amazon.com/es_es/cloudfront/latest/APIReference/API_Origins.html

___

• `Optional` **status**: `string`

The distribution’s status. When the status is Deployed, the distribution’s information is fully propagated to all CloudFront edge locations.

___

• `Optional` **web\_acl\_id**: `string`

A unique identifier that specifies the WAF web ACL, if any, to associate with this distribution
