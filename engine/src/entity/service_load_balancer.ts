import {
  Entity,
  PrimaryGeneratedColumn,
  JoinColumn,
  ManyToOne,
  Column,
} from 'typeorm'
import { ELB, TargetGroup, } from '.'

import { noDiff } from '../services/diff'

@Entity()
export class ServiceLoadBalancer {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TargetGroup, { eager: true, })
  @JoinColumn({
    name: 'target_group_id',
  })
  targetGroup?: TargetGroup;

  @ManyToOne(() => ELB, { eager: true, })
  @JoinColumn({
    name: 'elb_id',
  })
  elb?: ELB;

  @Column()
  containerName: string;

  @Column({
    type: 'int',
  })
  containerPort: number;
}
