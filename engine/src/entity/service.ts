import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
} from 'typeorm'
import { Cluster, TaskDefinition } from '.';
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
  @Column({
    unique: true,
  })
  name: string;

  @Column({
    nullable: true,
  })
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
  taskDefinition?: TaskDefinition;

  @Column({
    type: 'int',
  })
  desiredCount?: number;

  @Column({
    type: 'enum',
    enum: LaunchType,
  })
  launchType: LaunchType;

  @Column({
    type: 'enum',
    enum: SchedulingStrategy,
  })
  schedulingStrategy?: SchedulingStrategy;

  // TODO: add loadBalancers?: LoadBalancer[];

}
