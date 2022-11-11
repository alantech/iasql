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

  // must start and end with /
  // only can contain alphanumeric characters
  @Column({ nullable: true })
  path?: string;

  @Column({ nullable: true })
  userId?: string;

  @Column({
    type: 'text',
    array: true,
    nullable: true,
  })
  attachedPoliciesArns?: string[];
}
