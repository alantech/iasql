import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm'
import { AwsVpcConf, Cluster, TaskDefinition } from '.';
import { awsPrimaryKey } from '../services/aws-primary-key';

import { noDiff } from '../services/diff'
import { source, Source } from '../services/source-of-truth'

export enum LaunchType {
  EC2 = "EC2",
  EXTERNAL = "EXTERNAL",
  FARGATE = "FARGATE"
}

export enum SchedulingStrategy {
  DAEMON = "DAEMON",
  REPLICA = "REPLICA"
}

@source(Source.DB)
@Entity()
export class Service {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @awsPrimaryKey
  @noDiff
  @Column({
    unique: true,
  })
  name: string;

  @noDiff
  @Column({
    nullable: true,
  })
  arn?: string;

  @noDiff
  @Column({
    nullable: true,
  })
  status?: string;

  @ManyToOne(() => Cluster, { eager: true, })
  @JoinColumn({
    name: 'cluster_id',
  })
  cluster?: Cluster;

  @ManyToOne(() => TaskDefinition, { eager: true, })
  @JoinColumn({
    name: 'task_definition_id',
  })
  task?: TaskDefinition;

  @Column({
    type: 'int',
  })
  desiredCount?: number;

  @noDiff
  @Column({
    type: 'enum',
    enum: LaunchType,
  })
  launchType: LaunchType;

  @noDiff
  @Column({
    type: 'enum',
    enum: SchedulingStrategy,
  })
  schedulingStrategy?: SchedulingStrategy;

  @noDiff
  @OneToOne(() => AwsVpcConf, { eager: true, })
  @JoinColumn({
    name: 'aws_vpc_conf_id',
  })
  network?: AwsVpcConf;

  // TODO: add loadBalancers?: LoadBalancer[];

}
