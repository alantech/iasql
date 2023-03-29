import { Max, Min } from 'class-validator';
import {
  Check,
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import {
  EBSOptions,
  OpenSearchPartitionInstanceType,
  OpenSearchWarmPartitionInstanceType,
} from '@aws-sdk/client-opensearch';

import { Policy } from '../../../services/canonical-iam-policy';
import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { Certificate } from '../../aws_acm/entity';
import { SecurityGroup } from '../../aws_security_group/entity';
import { Subnet } from '../../aws_vpc/entity';

/**
 * Table to manage AWS OpenSearch domains. AWS OpenSearch supports both OpenSearch and ElasticSearch.
 *
 * @see https://docs.aws.amazon.com/opensearch-service/latest/developerguide/what-is.html
 */
@Entity()
export class Domain {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Name to identify the domain
   */
  @Column({ nullable: false })
  @cloudId
  domainName: string;

  /**
   * @public
   * Custom endpoint to use for opensearch application
   */
  @Column({ nullable: true })
  customEndpoint?: string;

  /**
   * @public
   * ForeignKey to the certificate that will be used with the custom domain
   */
  @ManyToOne(() => Certificate, certificate => certificate.id, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({ name: 'endpoint_certificate_id', referencedColumnName: 'id' })
  customEndpointCertificate?: Certificate;

  /**
   * @public
   * Version of the opensearch application - like OpenSearch_2.3
   */
  @Column()
  @Check(`
    "version" ~ '^Elasticsearch_[0-9]{1}\.[0-9]{1,2}$|^OpenSearch_[0-9]{1,2}\.[0-9]{1,2}$'
  `)
  version: string;

  /**
   * @public
   * Number of availability zones the opensearch should operate in - between 1 and 3
   */
  @Min(1)
  @Max(3)
  @Column({ type: 'int' })
  availabilityZoneCount: number;

  /**
   * @public
   * Instance type that is used for opensearch instances
   */
  @Column({ type: 'varchar', enum: OpenSearchPartitionInstanceType })
  instanceType: OpenSearchPartitionInstanceType;

  /**
   * @public
   * Number of instances that'll run opensearch
   */
  @Min(1)
  @Max(80)
  @Column({ type: 'int' })
  instanceCount: number;

  /**
   * @public
   * Options for the EBS volume if applicable - e.g. {"Iops": 3000, "EBSEnabled": true, "Throughput": 125, "VolumeSize": 10, "VolumeType": "gp3"}
   */
  @Column({ type: 'jsonb', nullable: true })
  ebsOptions?: EBSOptions;

  /**
   * @public
   * Instance type that's used for warm instances
   */
  @Column({ enum: OpenSearchWarmPartitionInstanceType, type: 'varchar', nullable: true })
  warmInstanceType?: OpenSearchWarmPartitionInstanceType;

  /**
   * @public
   * How many warm instances should opensearch have?
   */
  @Column({ nullable: true })
  warmInstanceCount?: number;

  /**
   * @public
   * Enable cold storage to have infrequently-accessed data on a cold disk
   */
  @Column({ default: false, nullable: true })
  coldStorage?: boolean;

  /**
   * @public
   * Instance type for master instances
   */
  @Column({ enum: OpenSearchPartitionInstanceType, type: 'varchar', nullable: true })
  dedicatedMasterType?: OpenSearchPartitionInstanceType;

  /**
   * @public
   * How many master instances?
   */
  @Column({ nullable: true })
  dedicatedMasterCount?: number;

  /**
   * @public
   * Auto-tune uses metrics to suggest improvements on opensearch cluster
   */
  @Column({ default: true, type: 'boolean' })
  autoTune: boolean;

  /**
   * @public
   * Subnets that opensearch instances should operate in
   */
  @ManyToMany(() => Subnet, { eager: true, nullable: true })
  @JoinTable({ name: 'domain_subnets' })
  subnets?: Subnet[];

  /**
   * @public
   * Security groups for opensearch instances
   */
  @ManyToMany(() => SecurityGroup, { eager: true, nullable: true })
  @JoinTable({ name: 'domain_security_groups' })
  securityGroups?: SecurityGroup[];

  /**
   * @public
   * Enable to have fine-grained access control on the cluster
   */
  @Column({ default: false })
  enableFineGrainedAccessControl: boolean;

  /**
   * @public
   * Admin user ARN for fine-grained-access control - should not have username and password if this is set
   */
  @Column({ nullable: true })
  fineGrainedAccessControlUserArn?: string;

  /**
   * @public
   * Admin username - can't be used together with user ARN
   */
  @Column({ nullable: true })
  fineGrainedAccessControlMasterUsername?: string;

  /**
   * @public
   * Admin password
   */
  @Column({ nullable: true })
  @Check(`
    fine_grained_access_control_master_password IS NULL OR length(fine_grained_access_control_master_password) >= 8
  `)
  fineGrainedAccessControlMasterPassword?: string;

  /**
   * @public
   * IAM Access policy for the cluster
   */
  @Column({ type: 'jsonb' })
  accessPolicy: Policy;

  /**
   * @public
   * Endpoint that can be used to access the opensearch application - comes from the cloud
   */
  @Column({ nullable: true })
  endpoint?: string; // comes from the cloud
  /**
   * @public
   * Region for the domain
   */
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  @cloudId
  region: string;
}
