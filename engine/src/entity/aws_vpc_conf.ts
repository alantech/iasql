import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, ManyToOne, JoinColumn, } from 'typeorm';
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

  // TODO: See if this can be removed once migrated to modules
  // The issue is that many to many relationships do not throw error on save if is an empty array
  // so it do not insert into the subnet jointable correctly. Security groups works because it is
  // requested and stored before by other dependencies
  @noDiff
  @ManyToOne(() => Subnet, { eager: true, })
  @JoinColumn({
    name: 'subnet_id',
  })
  subnet: Subnet;

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
