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
  PrimaryGeneratedColumn,
} from 'typeorm'

import { Cluster, TaskDefinition, ContainerDefinition } from '.';
import { TargetGroup } from '../../aws_elb@0.0.1/entity';
import { SecurityGroup } from '../../aws_security_group@0.0.1/entity';
import { cloudId, } from '../../../services/cloud-id'

export enum AssignPublicIp {
  DISABLED = "DISABLED",
  ENABLED = "ENABLED"
}

@Entity()
export class Service {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    unique: true,
  })
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

  @ManyToOne(() => Cluster)
  @JoinColumn({
    name: 'cluster_id',
  })
  cluster?: Cluster;

  @ManyToOne(() => TaskDefinition)
  @JoinColumn({
    name: 'task_definition_id',
  })
  task?: TaskDefinition;

  @Column({
    type: 'int',
  })
  desiredCount?: number;

  @Column("text", { array: true, })
  subnets: string[];

  @ManyToMany(() => SecurityGroup)
  @JoinTable({
    name: 'aws_service_security_groups'
  })
  securityGroups: SecurityGroup[];

  @Column({
    type: 'enum',
    enum: AssignPublicIp,
    default: AssignPublicIp.DISABLED
  })
  assignPublicIp: AssignPublicIp;

  @ManyToOne(() => TargetGroup)
  @JoinColumn({
    name: 'target_group_id',
  })
  targetGroup?: TargetGroup;

  @Column({
    default: false,
  })
  forceNewDeployment: boolean;

  @AfterLoad()
  @AfterInsert()
  @AfterUpdate()
  updateNulls() {
    const that: any = this;
    Object.keys(this).forEach(k => {
      if (that[k] === null) that[k] = undefined;
    });
  }
}
