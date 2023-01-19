import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';

// This is ridiculous. Can we fix this?

/**
 * @enum
 * The viewer protocol for the CloudFront distribution
 * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesViewerProtocolPolicy
 */
export enum viewerProtocolPolicyEnum {
  ALLOW_ALL = 'allow-all',
  REDIRECT_TO_HTTPS = 'redirect-to-https',
  HTTPS_ONLY = 'https-only',
}

/**
 * @enum
 * The origin protocol for the CloudFront distribution
 * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesOriginProtocolPolicy
 */
export enum originProtocolPolicyEnum {
  HTTP_ONLY = 'http-only',
  MATCH_VIEWER = 'match-viewer',
  HTTPS_ONLY = 'https-only',
}

/**
 * Table to query for all AWS CloudFront distributions in the system. Amazon CloudFront is a web service that speeds up distribution of your
 * static and dynamic web content, such as .html, .css, .js, and image files, to your users.
 *
 * You create a CloudFront distribution to tell CloudFront where you want content to be delivered from, and the details about how to track and manage content delivery.
 *
 * @example
 * ```sql TheButton[Manage a CloudFront distribution]="Manage a CloudFront distribution"
 *  INSERT INTO distribution (caller_reference, comment, enabled, is_ipv6_enabled, default_cache_behavior, origins ) VALUES ('s3-bucket-ref', 'a comment', true, false, "{
 * TargetOriginId: s3-caller,
 * ViewerProtocolPolicy: 'allow-all',
 * CachePolicyId: 'cache-policy-id',
 * }"", '[
 * {
 *   DomainName: `custom-bucket.s3.amazonaws.com`,
 *   Id: s3OriginId,
 *   S3OriginConfig: { OriginAccessIdentity: '' },
 * },
 * ]');
 *
 * SELECT * FROM distribution WHERE caller_reference='s3-bucket-ref';
 * DELETE FROM distribution WHERE caller_reference = 's3-bucket-ref';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-cloudfront-integration.ts#L148
 * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html
 *
 */
@Entity()
export class Distribution {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * AWS ID for the CloudFront distribution
   */
  @Column({
    nullable: true,
  })
  @cloudId
  distributionId?: string;

  /**
   * @public
   * Domain name assigned to the distribution by CloudFront
   */
  @Column({
    nullable: true,
  })
  domainName?: string;

  /**
   * @public
   * An unique value to identify the CloudFront distribution
   */
  @Column({
    nullable: true,
  })
  callerReference?: string;

  /**
   * @public
   * Internal comments to describe the distribution
   */
  @Column({
    nullable: false,
    default: '',
  })
  comment?: string;

  /**
   * @public
   * Whether the distribution is enabled or not
   */
  @Column({
    nullable: false,
    default: true,
  })
  enabled?: boolean;

  /**
   * @public
   * Whether to enable IPV6 for this distribution
   */
  @Column({
    nullable: true,
  })
  isIPV6Enabled?: boolean;

  /**
   * @public
   * A unique identifier that specifies the WAF web ACL, if any, to associate with this distribution
   */
  @Column({
    nullable: true,
  })
  webACLId?: string;

  /**
   * @public
   * A complex type that describes the default cache behavior
   * @see https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_DefaultCacheBehavior.html
   */
  @Column({
    type: 'json',
    nullable: false,
  })
  defaultCacheBehavior: {
    TargetOriginId: string | undefined;
    ViewerProtocolPolicy: viewerProtocolPolicyEnum;
    CachePolicyId: string | undefined;
  };

  /**
   * @public
   * A complex type that contains information about origins for this distribution.
   * @see https://docs.aws.amazon.com/es_es/cloudfront/latest/APIReference/API_Origins.html
   */
  @Column({
    type: 'json',
    nullable: false,
  })
  origins: {
    DomainName: string | undefined;
    Id: string | undefined;
    OriginShield: any;
    CustomOriginConfig:
      | {
          HTTPPort: number | undefined;
          HTTPSPort: number | undefined;
          OriginProtocolPolicy: originProtocolPolicyEnum;
        }
      | undefined;
    S3OriginConfig:
      | {
          OriginAccessIdentity: string | undefined;
        }
      | undefined;
  }[];

  /**
   * @public
   * The current version of the distribution's information
   */
  @Column({
    nullable: true,
  })
  eTag?: string;

  /**
   * @public
   * The distribution’s status. When the status is Deployed, the distribution’s information is fully propagated to all CloudFront edge locations.
   */
  @Column({
    nullable: true,
  })
  status?: string;
}
