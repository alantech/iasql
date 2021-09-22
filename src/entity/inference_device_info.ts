import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class InferenceDeviceInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'int',
  })
  count: number;

  @Column()
  name: string;

  @Column()
  manufacturer: string;
}
