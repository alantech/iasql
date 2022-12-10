import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { Vpc } from '../../aws_vpc/entity';

/**
 * Table to manage AWS security groups.
 * A security group controls the traffic that is allowed to reach and leave the resources that it is associated with.
 *
 * @example
 * ```sql
 * INSERT INTO security_group (description, group_name) VALUES ('sg description', 'sg_name');
 * SELECT * FROM security_group WHERE group_name = 'sg_name';
 * DELETE FROM security_group WHERE group_name = 'sg_name';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-security-group-integration.ts#L122
 * @see https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html
 */
@Unique('UQ_groupNameByVpc', ['groupName', 'vpc'])
@Unique('uq_security_group_region', ['id', 'region'])
@Entity()
export class SecurityGroup {
  /**
   * @private
   * Auto-incremented ID field for the security group
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Description for the security group
   */
  @Column()
  description?: string;

  /**
   * @public
   * Name for the security group
   */
  @Column()
  groupName: string;

  /**
   * @public
   * The Amazon Web Services account ID of the owner of the security group.
   */
  @Column({
    nullable: true,
  })
  ownerId?: string;

  /**
   * @public
   * AWS ID to identify the security group
   */
  @Column({
    nullable: true,
  })
  @cloudId
  groupId?: string;

  /**
   * @public
   * Reference of the VPC associated to this security group
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html
   */
  @ManyToOne(() => Vpc, { nullable: true, eager: true })
  @JoinColumn([
    {
      name: 'vpc_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  vpc?: Vpc;

  /**
   * @public
   * List of rules associated to this security group
   */
  @OneToMany(() => SecurityGroupRule, sgr => sgr.securityGroup)
  securityGroupRules: SecurityGroupRule[];

  /**
   * @public
   * Region for the security group
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

/**
 * Table to manage AWS security group rules.
 * A security group controls the traffic that is allowed to reach and leave the resources that it is associated with.
 *
 * @example
 * ```sql
 * INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
 * SELECT true, 'tcp', 443, 443, '0.0.0.0/8', 'rule_name', id FROM security_group WHERE group_name = 'sg_name';
 * SELECT * FROM security_group_rule INNER JOIN security_group ON security_group.id = security_group_rule.security_group_id
 * WHERE group_name = 'sg_name';
 * DELETE FROM security_group_rule WHERE source_security_group = (SELECT id FROM security_group WHERE group_name='sg_name')
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-security-group-integration.ts#L151
 * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules.html
 */
@Unique('UQ_rule', ['isEgress', 'ipProtocol', 'fromPort', 'toPort', 'cidrIpv4', 'securityGroup'])
@Unique('uq_security_group_rule_region', ['id', 'region'])
@Entity()
export class SecurityGroupRule {
  /**
   * @private
   * Auto-incremented ID field for EC2 instance
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * AWS ID representing the security group rule
   */
  @Column({
    nullable: true,
  })
  @cloudId
  securityGroupRuleId?: string;

  /**
   * @public
   * Reference for the security group associated to this rule
   */
  @ManyToOne(() => SecurityGroup)
  @JoinColumn([
    {
      name: 'security_group_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  securityGroup: SecurityGroup;

  /**
   * @public
   * If true, represents a rule for outbound traffic
   */
  @Column({
    nullable: false,
  })
  isEgress: boolean;

  /**
   * @public
   * The protocol to allow. The most common protocols are 'tcp', 'udp' and 'icmp'
   * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html
   */
  @Column({
    nullable: true,
  })
  ipProtocol?: string;

  /**
   * @public
   * Initial port to allow for an specific range. Minimum is 0
   * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html
   */
  @Column({
    nullable: true,
    type: 'int',
  })
  fromPort?: number;

  /**
   * @public
   * Final port to allow for an specific range. Maximum is 65535
   * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html
   */
  @Column({
    nullable: true,
    type: 'int',
  })
  toPort?: number;

  /**
   * @public
   * IPV4 CIDR referenced by this rule
   * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html
   */
  @Column({
    nullable: true,
    type: 'cidr',
  })
  cidrIpv4?: string;

  /**
   * @public
   * IPV6 CIDR referenced by this rule
   * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html
   */
  @Column({
    nullable: true,
    type: 'cidr',
  })
  cidrIpv6?: string;

  /**
   * @public
   * Reference for the rule prefix list. A managed prefix list is a set of one or more CIDR blocks.
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/managed-prefix-lists.html
   */
  @Column({
    nullable: true,
  })
  prefixListId?: string;

  /**
   * @public
   * Description for the security group rule
   */
  @Column({
    nullable: true,
  })
  description?: string;

  /**
   * @public
   * Reference for the source security group associated to the rule.
   * By specifying a VPC security group as the source, you allow incoming traffic from all instances (typically application servers) that use the source VPC security group.
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html
   */
  @Check(
    'Check_security_or_ip_permissions',
    `("source_security_group" IS NULL AND ("from_port" IS NOT NULL AND "to_port" IS NOT NULL AND ("cidr_ipv4" IS NOT NULL OR "cidr_ipv6" IS NOT NULL))) OR ("source_security_group" IS NOT NULL AND (("from_port" IS NULL OR "from_port"=-1) AND ("to_port" IS NULL OR "to_port"=-1) AND ("cidr_ipv4" IS NULL OR "cidr_ipv4"='0.0.0.0/0') AND ("cidr_ipv6" IS NULL)))`,
  )
  @ManyToOne(() => SecurityGroup, { nullable: true, eager: true })
  @JoinColumn({
    name: 'source_security_group',
  })
  sourceSecurityGroup?: SecurityGroup;

  /**
   * @public
   * Region for the security group rule
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
