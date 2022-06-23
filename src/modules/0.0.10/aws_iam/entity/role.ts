import {
  Entity,
  PrimaryColumn,
  Column,
  AfterLoad,
  AfterInsert,
  AfterUpdate,
} from 'typeorm'

import { cloudId, } from '../../../../services/cloud-id'


// TODO complete schema
@Entity()
export class Role {
  @Column({
    nullable: true,
  })
  arn?: string;

  // Guaranteed unique in AWS
  // Maximum 128 characters. Use alphanumeric and '+=,.@-_' characters.
  @PrimaryColumn()
  @cloudId
  roleName: string;

  @Column()
  assumeRolePolicyDocument: string;

  @Column({
    nullable: true,
  })
  description?: string;

  @Column({
    type: 'text',
    array: true,
    nullable: true,
  })
  attachedPoliciesArns?: string[];
  
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