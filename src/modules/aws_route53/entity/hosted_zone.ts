import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';

/**
 * Table to manage AWS Route 53 hosted zones: a hosted zone is a container for records, and
 * records contain information about how you want to route traffic for a specific domain
 *
 * @example
 * ```sql TheButton[Manage a Hosted Zone]="Manage a Hosted Zone"
 * INSERT INTO hosted_zone (domain_name) VALUES ('domain.com');
 * SELECT * FROM hosted_zone WHERE domain_name = 'domain.com';
 * DELETE FROM hosted_zone WHERE domain_name = 'domain.com';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-route53-integration.ts#L121
 * @see https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-working-with.html
 */
@Entity()
export class HostedZone {
  /**
   * @private
   * Auto-incremented ID field for the hosted zone
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * AWS ID to identify the hosted zone
   */
  @Column({
    unique: true,
    nullable: true,
  })
  @cloudId
  hostedZoneId: string;

  /**
   * @private
   * Domain name associated to the zone
   */
  @Column()
  domainName: string;
}
