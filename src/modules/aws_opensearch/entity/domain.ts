import { Max, Min } from 'class-validator';
import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import {
  OpenSearchPartitionInstanceType,
  OpenSearchWarmPartitionInstanceType,
  StorageType,
} from '@aws-sdk/client-opensearch/dist-types/models/models_0';

import { Policy } from '../../../services/canonical-iam-policy';
import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { Certificate } from '../../aws_acm/entity';
import { SecurityGroup } from '../../aws_security_group/entity';
import { Subnet } from '../../aws_vpc/entity';

export enum deploymentTypeEnum {
  PRODUCTION = 'PRODUCTION',
  DEVELOPMENT_AND_TESTING = 'DEVELOPMENT_AND_TESTING',
  CUSTOM = 'CUSTOM',
}

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
  customEndpointCertificate: Certificate;

  @Column({
    type: 'enum',
    enum: deploymentTypeEnum,
    default: deploymentTypeEnum.DEVELOPMENT_AND_TESTING,
  })
  deploymentType?: deploymentTypeEnum;

  @Column()
  version: string;

  @Min(1)
  @Max(3)
  @Column({ type: 'int' })
  AvailabilityZoneCount: number;

  @Column({ type: 'varchar', enum: OpenSearchPartitionInstanceType })
  instanceType: OpenSearchPartitionInstanceType;

  @Min(1)
  @Max(80)
  @Column({ type: 'int' })
  instanceCount: number;

  @Column({ type: 'jsonb' })
  storageType: StorageType;

  @Column({ enum: OpenSearchWarmPartitionInstanceType, type: 'varchar' })
  warmInstanceType?: OpenSearchWarmPartitionInstanceType;

  @Column()
  warmInstanceCount?: number;

  @Column()
  warmColdStorage?: boolean;

  @Column({ enum: OpenSearchPartitionInstanceType, type: 'varchar' })
  dedicatedMasterType?: OpenSearchPartitionInstanceType;

  @Column()
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
  fineGrainedAccessControlMasterPassword?: string;

  @Column({ type: 'jsonb' })
  accessPolicy: Policy;

  // encryption: https all traffic, node2node enc, data at rest encryption
  // tags
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