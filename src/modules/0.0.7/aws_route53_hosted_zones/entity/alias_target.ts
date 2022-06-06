import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { LoadBalancer } from '../../aws_elb/entity';

@Entity()
export class AliasTarget {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    default: true,
  })
  evaluateTargetHealth: boolean;

  @ManyToOne(() => LoadBalancer, {
    eager: true,
  })
  @JoinColumn({
    name: 'load_balancer_name',
  })
  loadBalancer?: LoadBalancer;

  // TODO: Add gradually new alias target FKs
}
