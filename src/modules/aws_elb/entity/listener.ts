import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { Certificate } from '../../aws_acm/entity';
import { LoadBalancer } from './load_balancer';
import { TargetGroup, ProtocolEnum } from './target_group';

/**
 * @enum
 * Different rule action types
 * Currently only "forward" is supported
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html#rule-action-types
 */
export enum ActionTypeEnum {
  // AUTHENTICATE_COGNITO = "authenticate-cognito",
  // AUTHENTICATE_OIDC = "authenticate-oidc",
  // FIXED_RESPONSE = "fixed-response",
  FORWARD = 'forward',
  // REDIRECT = "redirect"
}

/**
 * Table to manage AWS Load Balancer listeners. Before you start using your Application Load Balancer, you must add one or more listeners.
 * A listener is a process that checks for connection requests, using the protocol and port that you configure.
 * The rules that you define for a listener determine how the load balancer routes requests to its registered targets.
 *
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html
 */
@Unique('UQ_load_balancer__port', ['loadBalancer', 'port'])
@Entity()
export class Listener {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * AWS ARN that identifies the listener
   */
  @Column({ nullable: true })
  @cloudId
  listenerArn?: string;

  /**
   * @public
   * Reference to the load balancer associated to this listener
   */
  @ManyToOne(() => LoadBalancer, {
    nullable: false,
    eager: true,
  })
  @JoinColumn()
  loadBalancer: LoadBalancer;

  /**
   * @public
   * Port exposed at the listener
   */
  @Column({ type: 'integer' })
  port: number;

  /**
   * @public
   * Protocol for the exposed port
   */
  @Column({
    type: 'enum',
    enum: ProtocolEnum,
  })
  protocol: ProtocolEnum;

  /**
   * @public
   * Action type for this specific listener
   */
  @Column({
    type: 'enum',
    enum: ActionTypeEnum,
    default: ActionTypeEnum.FORWARD,
  })
  actionType: ActionTypeEnum;

  /**
   * @public
   * Reference to the target group associated with this listener
   */
  @ManyToOne(() => TargetGroup, {
    nullable: false,
    eager: true,
  })
  @JoinColumn()
  targetGroup: TargetGroup;

  /**
   * @public
   * Reference to the certificate used by the listener when exposing HTTPs ports
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-https-listener.html
   */
  @ManyToOne(() => Certificate, {
    eager: true,
    nullable: true,
  })
  @JoinColumn({
    name: 'certificate_id',
  })
  certificate?: Certificate;

  /**
   * @public
   * Type of SSL policy to use
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-https-listener.html#describe-ssl-policies
   */
  @Column({
    nullable: true,
  })
  sslPolicy?: string;

  // TODO: tbd
  // AlpnPolicy?: string[];
}
