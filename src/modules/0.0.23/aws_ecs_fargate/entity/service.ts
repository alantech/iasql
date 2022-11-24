import {
  Check,
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Cluster, TaskDefinition } from '.';
import { cloudId } from '../../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { TargetGroup } from '../../aws_elb/entity';
import { SecurityGroup } from '../../aws_security_group/entity';

export enum AssignPublicIp {
  DISABLED = 'DISABLED',
  ENABLED = 'ENABLED',
}

@Entity()
@Check('check_service_subnets', 'check_service_subnets(subnets)')
@Unique('uq_service_name_region', ['name', 'region'])
export class Service {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({
    nullable: true,
  })
  @cloudId
  arn?: string;

  @Column({
    nullable: true,
  })
  status?: string;

  @ManyToOne(() => Cluster, {
    eager: true,
  })
  @JoinColumn({
    name: 'cluster_id',
  })
  cluster?: Cluster;

  @ManyToOne(() => TaskDefinition, {
    eager: true,
  })
  @JoinColumn({
    name: 'task_definition_id',
  })
  task?: TaskDefinition;

  @Column({
    type: 'int',
  })
  desiredCount?: number;

  @Column('text', { array: true })
  subnets: string[];

  @ManyToMany(() => SecurityGroup, {
    eager: true,
  })
  @JoinTable({
    name: 'service_security_groups',
  })
  securityGroups: SecurityGroup[];

  @Column({
    type: 'enum',
    enum: AssignPublicIp,
    default: AssignPublicIp.DISABLED,
  })
  assignPublicIp: AssignPublicIp;

  @ManyToOne(() => TargetGroup, {
    eager: true,
  })
  @JoinColumn()
  targetGroup?: TargetGroup;

  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;
}
