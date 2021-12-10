import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
  OneToOne,
  ManyToMany,
  JoinTable,
} from 'typeorm'
import { AwsVpcConf, Cluster, ServiceLoadBalancer, TaskDefinition } from '.';

export enum LaunchType {
  EC2 = "EC2",
  EXTERNAL = "EXTERNAL",
  FARGATE = "FARGATE"
}

export enum SchedulingStrategy {
  DAEMON = "DAEMON",
  REPLICA = "REPLICA"
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

  @OneToOne(() => AwsVpcConf, { cascade: true, nullable: true, })
  @JoinColumn({
    name: 'aws_vpc_conf_id',
  })
  network?: AwsVpcConf;

  @ManyToMany(() => ServiceLoadBalancer, { cascade: true, })
  @JoinTable()
  loadBalancers?: ServiceLoadBalancer[];
}
