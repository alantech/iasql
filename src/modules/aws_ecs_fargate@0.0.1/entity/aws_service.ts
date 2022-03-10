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

import { AwsCluster, AwsTaskDefinition, AwsContainerDefinition } from '.';
import { AwsTargetGroup } from '../../aws_elb@0.0.1/entity';
import { AwsSecurityGroup } from '../../aws_security_group@0.0.1/entity';
import { cloudId, } from '../../../services/cloud-id'

export enum AssignPublicIp {
  DISABLED = "DISABLED",
  ENABLED = "ENABLED"
}

@Entity()
export class AwsService {
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

  @ManyToOne(() => AwsCluster)
  @JoinColumn({
    name: 'cluster_id',
  })
  cluster?: AwsCluster;

  @ManyToOne(() => AwsTaskDefinition)
  @JoinColumn({
    name: 'task_definition_id',
  })
  task?: AwsTaskDefinition;

  @Column({
    type: 'int',
  })
  desiredCount?: number;

  @Column("text", { array: true, })
  subnets: string[];

  @ManyToMany(() => AwsSecurityGroup)
  @JoinTable({
    name: 'aws_service_security_groups'
  })
  securityGroups: AwsSecurityGroup[];

  @Column({
    type: 'enum',
    enum: AssignPublicIp,
    default: AssignPublicIp.DISABLED
  })
  assignPublicIp: AssignPublicIp;

  @ManyToOne(() => AwsTargetGroup)
  @JoinColumn({
    name: 'target_group_id',
  })
  targetGroup?: AwsTargetGroup;

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
