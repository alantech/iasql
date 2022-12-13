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
 * @example
 * ```sql TheButton[Manage an Load Balancer listener]="Manage a Load Balancer listener"
 * INSERT INTO listener (load_balancer_id, port, protocol, target_group_id) VALUES
 * ((SELECT id FROM load_balancer WHERE load_balancer_name = 'lb_name'), 5678, 'tcp',
 * (SELECT id FROM target_group WHERE target_group_name = 'target_group_name'));
 *
 * DELETE FROM listener WHERE load_balancer_id = (SELECT id FROM load_balancer WHERE load_balancer_name = 'lb_name');
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-elb-integration.ts#L400
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html
 */
@Unique('UQ_load_balancer__port', ['loadBalancer', 'port'])
@Entity()
export class Listener {
  /**
   * @private
   * Auto-incremented ID field for storing builds
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
