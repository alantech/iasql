import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { cloudId, } from 'iasql/services/cloud-id'

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

