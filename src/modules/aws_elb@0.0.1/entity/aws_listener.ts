import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm'

import { AwsLoadBalancer, } from './aws_load_balancer'
import { AwsTargetGroup, ProtocolEnum, } from './aws_target_group'

export enum ActionTypeEnum {
  // AUTHENTICATE_COGNITO = "authenticate-cognito",
  // AUTHENTICATE_OIDC = "authenticate-oidc",
  // FIXED_RESPONSE = "fixed-response",
  FORWARD = "forward",
  // REDIRECT = "redirect"
}

@Unique('UQ_load_balancer__port', ['loadBalancer', 'port'])
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

  @Column({
    type: 'enum',
    enum: ActionTypeEnum,
    default: ActionTypeEnum.FORWARD,
  })
  actionType: ActionTypeEnum;

  @ManyToOne(() => AwsTargetGroup)
  @JoinColumn({
    name: 'target_group_id',
  })
  targetGroup: AwsTargetGroup;

  // TODO: tbd
  // Certificates?: Certificate[];
  // SslPolicy?: string;
  // AlpnPolicy?: string[];
}