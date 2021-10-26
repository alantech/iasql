import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, } from 'typeorm';
import { SecurityGroup, Subnet } from '.';
import { noDiff } from '../services/diff';

export enum AssignPublicIp {
  DISABLED = "DISABLED",
  ENABLED = "ENABLED"
}

@Entity()
export class AwsVpcConf {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany(() => Subnet, { eager: true, })
  @JoinTable()
  subnets: Subnet[];

  @ManyToMany(() => SecurityGroup, { eager: true, })
  @JoinTable()
  securityGroups: SecurityGroup[];

  @Column({
    nullable: true,
    type: 'enum',
    enum: AssignPublicIp,
  })
  assignPublicIp?: AssignPublicIp;
}
