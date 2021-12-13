import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm'

import { AwsAction, } from './aws_action'
import { AwsLoadBalancer, } from './aws_load_balancer'
import { ProtocolEnum, } from './aws_target_group'

@Entity()
export class AwsListener {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, })
  listenerArn?: string;

  @ManyToOne(() => AwsLoadBalancer, { nullable: false, })
  @JoinColumn({
    name: 'aws_load_balancer_id',
  })
  loadBalancer: AwsLoadBalancer;

  @Column({ type: 'integer', })
  port: number;

  @Column({
    type: 'enum',
    enum: ProtocolEnum,
  })
  protocol: ProtocolEnum;

  @ManyToMany(() => AwsAction, { cascade: true, })
  @JoinTable()
  defaultActions?: AwsAction[];

  // TODO: tbd
  // Certificates?: Certificate[];
  // SslPolicy?: string;
  // AlpnPolicy?: string[];
}