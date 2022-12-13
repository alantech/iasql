import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to manage AWS Elastic IP addresses.
 * An Elastic IP address is a static IPv4 address designed for dynamic cloud computing. An Elastic IP address is allocated to your AWS account, and is yours until you release it.
 *
 * @example
 * ```sql TheButton[Manage an Elastic IP]="Manage an Elastic IP"
 * INSERT INTO elastic_ip (tags) VALUES ('{"name": "test_eip"}');
 * SELECT * FROM elastic_ip WHERE tags ->> 'name' = 'test_eip';
 * DELETE FROM elastic_ip WHERE tags ->> 'name' = 'test_eip';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-vpc-integration.ts#L300
 * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html
 */
@Entity()
@Unique('elasticip_id_region', ['id', 'region']) // So the NAT Gateway entity can join on both
export class ElasticIp {
  /**
   * @private
   * Auto-incremented ID field for the elastic IP
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * AWS ID to identify the elastic IP
   */
  @Column({ nullable: true })
  @cloudId
  allocationId?: string;

  /**
   * @public
   * Reserved public IP address
   *
   */
  @Column({ nullable: true, unique: true })
  publicIp?: string;

  /**
   * @public
   * Complex type to provide identifier tags for the instance
   * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

  /**
   * @public
   * Reference to the region where it belongs
   */
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  @cloudId
  region: string;
}
