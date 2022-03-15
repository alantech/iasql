import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm'

import { LoadBalancer, } from './load_balancer'
import { TargetGroup, ProtocolEnum, } from './target_group'
import { cloudId, } from '../../../services/cloud-id'

export enum ActionTypeEnum {
  // AUTHENTICATE_COGNITO = "authenticate-cognito",
  // AUTHENTICATE_OIDC = "authenticate-oidc",
  // FIXED_RESPONSE = "fixed-response",
  FORWARD = "forward",
  // REDIRECT = "redirect"
}

@Unique('UQ_load_balancer__port', ['loadBalancer', 'port'])
@Entity()
export class Listener {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, })
  @cloudId
  listenerArn?: string;

  @ManyToOne(() => LoadBalancer, { nullable: false, })
  @JoinColumn({
    name: 'aws_load_balancer_id',
  })
  loadBalancer: LoadBalancer;

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

  @ManyToOne(() => TargetGroup)
  @JoinColumn({
    name: 'target_group_id',
  })
  targetGroup: TargetGroup;

  // TODO: tbd
  // Certificates?: Certificate[];
  // SslPolicy?: string;
  // AlpnPolicy?: string[];
}