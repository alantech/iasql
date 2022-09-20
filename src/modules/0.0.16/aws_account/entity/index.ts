import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';

// This is ridiculous. Can we fix this?

@Entity({
  name: 'aws_account',
})
export class AwsAccountEntity {
  @PrimaryGeneratedColumn()
  @cloudId
  id: number;

  @Column()
  accessKeyId: string;

  @Column()
  secretAccessKey: string;

  @Column()
  region: string;
}
