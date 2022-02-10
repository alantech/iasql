import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity({
  name: 'aws_account',
})
export class AwsAccountEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  accessKeyId: string;

  @Column()
  secretAccessKey: string;

  region: string;
}

