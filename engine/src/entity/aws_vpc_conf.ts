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
  // so the lazy loader is not able to enqueue it again until subnets are saved. As a result the entity
  // is created but it do not insert into the subnet join table correctly.
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
