import {
  AfterInsert,
  AfterLoad,
  AfterUpdate,
  Column,
  Entity,
  PrimaryColumn,
} from 'typeorm';

import { cloudId, } from '../../../../services/cloud-id'

import logger from '../../../../services/logger'

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
      if (k === 'description') logger.warn(`+++ hook description value ${that[k]}`);
      if (that[k] === null) that[k] = undefined;
      if (k === 'description') logger.warn(`+++ hook updated description value ${that[k]}`);
    });
  }
}