import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity()
export class AwsSecurityGroup {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true,
  })
  description?: string;

  @Column({
    nullable: true,
  })
  groupName?: string;

  @Column({
    nullable: true,
  })
  ownerId?: string;

  @Column({
    nullable: true,
  })
  groupId?: string;

  @Column({
    nullable: true,
  })
  vpcId?: string;

  @OneToMany(() => AwsSecurityGroupRule, sgr => sgr.securityGroup)
  securityGroupRules: AwsSecurityGroupRule[];
}


@Entity()
export class AwsSecurityGroupRule {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true,
  })
  securityGroupRuleId?: string;

  @ManyToOne(() => AwsSecurityGroup)
  @JoinColumn({
    name: 'security_group_id',
  })
  securityGroup: AwsSecurityGroup;

  @Column({
    nullable: false,
  })
  isEgress: boolean;

  @Column({
    nullable: false,
  })
  ipProtocol: string;

  @Column({
    nullable: true,
    type: 'int',
  })
  fromPort?: number;

  @Column({
    nullable: true,
    type: 'int',
  })
  toPort?: number;

  @Column({
    nullable: true,
    type: 'cidr',
  })
  cidrIpv4?: string;

  @Column({
    nullable: true,
    type: 'cidr',
  })
  cidrIpv6?: string;

  @Column({
    nullable: true,
  })
  prefixListId?: string;

  @Column({
    nullable: true,
  })
  description?: string;
}
