import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';

/**
 * Table to manage AWS Route 53 hosted zones: a hosted zone is a container for records, and
 * records contain information about how you want to route traffic for a specific domain
 *
 * @see https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-working-with.html
 */
@Entity()
export class HostedZone {
  /**
   * @private
   * Auto-incremented ID field
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
