import { Column, Entity, PrimaryColumn } from 'typeorm';

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
}
