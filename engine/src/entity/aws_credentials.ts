import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class AWSCredentials {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  accessKeyId: string;

  @Column({
    unique: true,
  })
  secretAccessKey: string;
}
