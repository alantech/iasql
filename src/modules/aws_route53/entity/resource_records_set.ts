import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, Check } from 'typeorm';

import { AliasTarget } from './alias_target';
import { HostedZone } from './hosted_zone';

/**
 * @enum
 * Different types of records that can be created on a recordset
 * @see https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/ResourceRecordTypes.html
 */
export enum RecordType {
  A = 'A',
  AAAA = 'AAAA',
  CAA = 'CAA',
  CNAME = 'CNAME',
  DS = 'DS',
  MX = 'MX',
  NAPTR = 'NAPTR',
  NS = 'NS',
  PTR = 'PTR',
  SOA = 'SOA',
  SPF = 'SPF',
  SRV = 'SRV',
  TXT = 'TXT',
}

/**
 * Table to manage AWS Route 53 recordsets. After you create a hosted zone for your domain, such as example.com, you create records to tell the
 * Domain Name System (DNS) how you want traffic to be routed for that domain. Each record includes the name of a domain or a subdomain,
 * a record type (for example, a record with a type of MX routes email), and other information applicable to the record type (for MX records, the host name of one or more mail servers and a priority for each server).
 *
 * @example
 * ```sql TheButton[Manage a RecordSet]="Manage a RecordSet"
 * INSERT INTO resource_record_set (name, record_type, record, ttl, parent_hosted_zone_id) SELECT 'name', 'CNAME', 'domain.com.', 300, id
 * FROM hosted_zone WHERE domain_name = 'domain.com.';
 *
 * SELECT * FROM resource_record_set INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id WHERE domain_name = 'domain.com.';
 *
 * DELETE FROM resource_record_set USING hosted_zone WHERE hosted_zone.id IN (SELECT id FROM hosted_zone WHERE domain_name = 'domain.com.' ORDER BY ID DESC LIMIT 1);
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-route53-integration.ts#L294
 * @see https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/rrsets-working-with.html
 */
@Unique('UQ_name__record_type', ['parentHostedZone', 'name', 'recordType'])
@Check(
  'Check_record__alias_target',
  '("record" is null and "alias_target_id" is not null) or ("record" is not null and "alias_target_id" is null)',
)
@Check(
  'Check_record__ttl',
  '("record" is null and "ttl" is null and "alias_target_id" is not null) or ("record" is not null and "ttl" is not null and "alias_target_id" is null)',
)
@Entity()
export class ResourceRecordSet {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Name for the recordset
   */
  @Column()
  name: string;

  /**
   * @public
   * Type of record to create
   */
  @Column({
    type: 'enum',
    enum: RecordType,
  })
  recordType: RecordType;

  /**
   * @public
   * Content for the record to create. Content will depend on the type of record to create
   * @see https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-values-basic.html#rrsets-values-basic-value
   */
  @Column({ nullable: true })
  record?: string;

  /**
   * @public
   * The amount of time, in seconds, that you want DNS recursive resolvers to cache information about this record
   * @see https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-values-basic.html#rrsets-values-basic-ttl
   */
  @Column({
    type: 'int',
    nullable: true,
  })
  ttl?: number;

  /**
   * @public
   * Reference to the hosted zone for this record
   */
  @ManyToOne(() => HostedZone, { eager: true })
  @JoinColumn({
    name: 'parent_hosted_zone_id',
  })
  parentHostedZone: HostedZone;

  /**
   * @public
   * Reference to the alias target for this record
   */
  @ManyToOne(() => AliasTarget, {
    cascade: true,
    eager: true,
    nullable: true,
  })
  @JoinColumn({
    name: 'alias_target_id',
  })
  aliasTarget?: AliasTarget;
}
