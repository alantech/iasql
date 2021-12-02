import {
  Entity,
  PrimaryGeneratedColumn,
  JoinColumn,
  ManyToOne,
  Column,
} from 'typeorm'

import { AwsLoadBalancer, AwsTargetGroup, } from '../../aws_elb/entity'

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
