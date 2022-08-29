import { AfterInsert, AfterLoad, AfterUpdate, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';

@Entity()
export class ElasticIp {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  @cloudId
  allocationId?: string;

  @Column({ nullable: true, unique: true })
  publicIp?: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

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
