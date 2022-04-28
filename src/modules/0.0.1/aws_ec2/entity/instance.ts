import {
  AfterLoad,
  AfterInsert,
  AfterUpdate,
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { cloudId, } from 'iasql/services/cloud-id'

// TODO: Is there a better way to deal with cross-module entities?
import { SecurityGroup, } from '../../aws_security_group/entity';

// TODO complete instance schema
@Entity()
export class Instance {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true
  })
  @cloudId
  instanceId?: string;

  @Column()
  ami: string;

  @Column({
    unique: true,
  })
  name: string;

  @Column()
  instanceType: string;

  @Column({
    nullable: true,
  })
  keyPairName: string;

  @ManyToMany(() => SecurityGroup, { eager: true, })
  @JoinTable({
    name: 'instance_security_groups',
  })
  securityGroups: SecurityGroup[]

  @AfterLoad()
  @AfterInsert()
  @AfterUpdate()
  updateNulls() {
    const that: any = this;
    Object.keys(this).forEach(k => {
      if (that[k] === null) that[k] = undefined;
    });
  }
}