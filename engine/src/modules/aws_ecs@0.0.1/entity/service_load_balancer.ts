import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { AwsLoadBalancer, AwsTargetGroup, } from '../../aws_elb@0.0.1/entity'

@Entity()
export class ServiceLoadBalancer {
  @PrimaryGeneratedColumn()
  id?: number;

  @ManyToOne(() => AwsTargetGroup)
  @JoinColumn({
    name: 'target_group_id',
  })
  targetGroup?: AwsTargetGroup;

  @ManyToOne(() => AwsLoadBalancer)
  @JoinColumn({
    name: 'elb_id',
  })
  elb?: AwsLoadBalancer;

  @Column()
  containerName: string;

  @Column({
    type: 'int',
  })
  containerPort: number;
}
