import {
  AfterInsert,
  AfterLoad,
  AfterUpdate,
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { Cluster, TaskDefinition, ContainerDefinition } from '.';
import { cloudId } from '../../../../services/cloud-id';
import { TargetGroup } from '../../aws_elb/entity';
import { SecurityGroup } from '../../aws_security_group/entity';

export enum AssignPublicIp {
  DISABLED = 'DISABLED',
  ENABLED = 'ENABLED',
}

@Entity()
export class Service {
  @PrimaryColumn()
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
    name: 'cluster_name',
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
  @JoinColumn({
    name: 'target_group_name',
  })
  targetGroup?: TargetGroup;

  @Column({
    default: false,
  })
  forceNewDeployment: boolean;
}
