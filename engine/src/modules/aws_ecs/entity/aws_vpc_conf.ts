import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
} from 'typeorm';

import { AwsSecurityGroup, } from '../../aws_security_group/entity';
import { AwsSubnet, } from '../../aws_account/entity';

export enum AssignPublicIp {
  DISABLED = "DISABLED",
  ENABLED = "ENABLED"
}

@Entity()
export class AwsVpcConf {
  @PrimaryGeneratedColumn()
  id?: number;

  @ManyToMany(() => AwsSubnet)
  @JoinTable()
  subnets: AwsSubnet[];

  @ManyToMany(() => AwsSecurityGroup)
  @JoinTable()
  securityGroups: AwsSecurityGroup[];

  @Column({
    nullable: true,
    type: 'enum',
    enum: AssignPublicIp,
  })
  assignPublicIp?: AssignPublicIp;
}
