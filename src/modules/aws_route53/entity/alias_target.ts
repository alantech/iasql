import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { LoadBalancer } from '../../aws_elb/entity';

/**
 * Table to manage AWS Route 53 alias target:  Information about the AWS resource, such as a CloudFront
 * distribution or an Amazon S3 bucket, that you want to route traffic to.
 *
 * @example
 * ```sql
 * INSERT INTO alias_target (load_balancer_id) VALUES ((SELECT id FROM load_balancer WHERE load_balancer_name = 'lb_name'));
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-route53-integration.ts#L343
 * @see https://docs.aws.amazon.com/Route53/latest/APIReference/API_AliasTarget.html
 */
@Entity()
export class AliasTarget {
  /**
   * @private
   * Auto-incremented ID field for the alias target
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Applies only to alias, failover alias, geolocation alias, latency alias, and weighted alias resource record sets:
   * When EvaluateTargetHealth is true, an alias resource record set inherits the health of the referenced AWS resource,
   * such as an ELB load balancer or another resource record set in the hosted zone.
   * @see https://docs.aws.amazon.com/Route53/latest/APIReference/API_AliasTarget.html
   */
  @Column({
    default: true,
  })
  evaluateTargetHealth: boolean;

  /**
   * @public
   * Reference to the load balancer where the alias target is pointing
   * TODO: Add gradually new alias target FKs
   */
  @ManyToOne(() => LoadBalancer, {
    eager: true,
  })
  @JoinColumn()
  loadBalancer?: LoadBalancer;
}
