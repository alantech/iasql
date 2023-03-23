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

  @Column({ nullable: true })
  customEndpoint?: string;

  @ManyToOne(() => Certificate, certificate => certificate.id, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({ name: 'endpoint_certificate_id', referencedColumnName: 'id' })
  customEndpointCertificate?: Certificate;

  @Column()
  @Check(`
    "version" ~ '^Elasticsearch_[0-9]{1}\.[0-9]{1,2}$|^OpenSearch_[0-9]{1,2}\.[0-9]{1,2}$'
  `)
  version: string;

  @Min(1)
  @Max(3)
  @Column({ type: 'int' })
  availabilityZoneCount: number;

  @Column({ type: 'varchar', enum: OpenSearchPartitionInstanceType })
  instanceType: OpenSearchPartitionInstanceType;

  @Min(1)
  @Max(80)
  @Column({ type: 'int' })
  instanceCount: number;

  @Column({ type: 'jsonb', nullable: true })
  ebsOptions?: EBSOptions;

  @Column({ enum: OpenSearchWarmPartitionInstanceType, type: 'varchar', nullable: true })
  warmInstanceType?: OpenSearchWarmPartitionInstanceType;

  @Column({ nullable: true })
  warmInstanceCount?: number;

  @Column({ default: false, nullable: true })
  coldStorage?: boolean;

  @Column({ enum: OpenSearchPartitionInstanceType, type: 'varchar', nullable: true })
  dedicatedMasterType?: OpenSearchPartitionInstanceType;

  @Column({ nullable: true })
  dedicatedMasterCount?: number;

  @Column({ default: true, type: 'boolean' })
  autoTune: boolean;

  @ManyToMany(() => Subnet, { eager: true, nullable: true })
  @JoinTable({ name: 'domain_subnets' })
  subnets?: Subnet[];

  @ManyToMany(() => SecurityGroup, { eager: true, nullable: true })
  @JoinTable({ name: 'domain_security_groups' })
  securityGroups?: SecurityGroup[];

  @Column({ default: false })
  enableFineGrainedAccessControl: boolean;

  @Column({ nullable: true })
  fineGrainedAccessControlUserArn?: string;

  @Column({ nullable: true })
  fineGrainedAccessControlMasterUsername?: string;

  @Column({ nullable: true })
  @Check(`
    fine_grained_access_control_master_password IS NULL OR length(fine_grained_access_control_master_password) >= 8
  `)
  fineGrainedAccessControlMasterPassword?: string;

  @Column({ type: 'jsonb' })
  accessPolicy: Policy;

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
