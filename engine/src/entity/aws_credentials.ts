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

  // TODO remove and add multi region support by attaching region columns
  // to the various entities as appropriate
  @Column()
  region: string;
}
