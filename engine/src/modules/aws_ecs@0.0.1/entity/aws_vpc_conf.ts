import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AwsSecurityGroup, } from '../../aws_security_group@0.0.1/entity';

export enum AssignPublicIp {
  DISABLED = "DISABLED",
  ENABLED = "ENABLED"
}

@Entity()
export class AwsVpcConf {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column("text", { array: true, nullable: true, })
  subnets: string[];

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
