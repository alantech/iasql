import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';

// TODO complete schema
@Entity()
export class IamUser {
  @Column({
    nullable: true,
  })
  arn?: string;

  // Guaranteed unique in AWS
  // Maximum 128 characters. Use alphanumeric and '+=,.@-_' characters.
  @PrimaryColumn()
  @cloudId
  userName: string;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createDate: Date;

  @Column({ nullable: true })
  path?: string;

  @Column({ nullable: true })
  userId?: string;
}
