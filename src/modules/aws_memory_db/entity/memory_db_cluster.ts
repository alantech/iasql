import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { SecurityGroup } from '../../aws_security_group/entity';
import { SubnetGroup } from './subnet_group';

export enum NodeTypeEnum {
  db_t4g_small = 'db.t4g.small',
  db_t4g_medium = 'db.t4g.medium',
  db_r6g_large = 'db.r6g.large',
  db_r6g_xlarge = 'db.r6g.xlarge',
  db_r6g_2xlarge = 'db.r6g.2xlarge',
  db_r6g_4xlarge = 'db.r6g.4xlarge',
  db_r6g_8xlarge = 'db.r6g.8xlarge',
  db_r6g_12xlarge = 'db.r6g.12xlarge',
  db_r6g_16xlarge = 'db.r6g.16xlarge',
}

@Entity()
@Unique('uq_memory_db_cluster_id_region', ['id', 'region'])
@Unique('uq_memory_db_cluster_name_region', ['clusterName', 'region'])
export class MemoryDBCluster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @cloudId
  clusterName: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ type: 'int', default: 6379 })
  port: number;

  // custom enum https://docs.aws.amazon.com/memorydb/latest/devguide/nodes.supportedtypes.html
  @Column({
    type: 'enum',
    enum: NodeTypeEnum,
    default: NodeTypeEnum.db_r6g_large,
  })
  nodeType: NodeTypeEnum;

  @ManyToMany(() => SecurityGroup, { eager: true })
  @JoinTable({
    name: 'memory_db_cluster_security_groups',
    joinColumns: [
      { name: 'memory_db_cluster_id', referencedColumnName: 'id' },
      { name: 'region', referencedColumnName: 'region' },
    ],
    inverseJoinColumns: [{ name: 'security_group_id', referencedColumnName: 'id' }],
  })
  securityGroups?: SecurityGroup[];

  @ManyToOne(() => SubnetGroup, subnetGroup => subnetGroup.subnetGroupName, {
    nullable: false,
    eager: true,
  })
  @JoinColumn([
    {
      name: 'subnet_group_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  subnetGroup: SubnetGroup;

  @Column({ nullable: true })
  arn?: string;

  // todo: enum?
  @Column({ nullable: true })
  status?: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

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
