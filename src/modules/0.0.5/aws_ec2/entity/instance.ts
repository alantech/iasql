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

// TODO: Is there a better way to deal with cross-module entities?
import { SecurityGroup, } from '../../aws_security_group/entity';
import { cloudId, } from '../../../../services/cloud-id'

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

  @Column()
  instanceType: string;

  @Column({
    nullable: true,
  })
  keyPairName: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  tags: { [key: string]: string }

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