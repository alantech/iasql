import { json } from 'stream/consumers';
import { Column, Entity, PrimaryColumn, AfterLoad, AfterInsert, AfterUpdate } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';

@Entity()
export class Bucket {
  @PrimaryColumn({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  name: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  policyDocument?: any;

  @Column({
    nullable: true,
    type: 'timestamp without time zone',
  })
  createdAt?: Date;

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
