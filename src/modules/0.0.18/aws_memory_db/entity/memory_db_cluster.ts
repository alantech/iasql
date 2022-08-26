import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { cloudId, } from '../../../../services/cloud-id'
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
  db_r6g_16xlarg = 'db.r6g.16xlarg',
}

@Entity()
export class MemoryDBCluster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, })
  @cloudId
  clusterName: string;

  @Column({ nullable: true, })
  description?: string;

  @Column({ nullable: true, })
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

  @ManyToMany(() => SecurityGroup, { eager: true, })
  @JoinTable({
    name: 'memory_db_cluster_security_groups',
  })
  securityGroups?: SecurityGroup[];

  @ManyToOne(() => SubnetGroup, subnetGroup => subnetGroup.subnetGroupName, {
    nullable: false,
    eager: true,
  })
  @JoinColumn({
    name: 'subnet_group',
  })
  subnetGroup: SubnetGroup;

  @Column({ nullable: true, })
  arn?: string;

  // todo: enum?
  @Column({ nullable: true, })
  status?: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };
}
