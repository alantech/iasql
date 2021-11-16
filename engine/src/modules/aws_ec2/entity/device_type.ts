import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm';

@Entity()
export class DeviceType {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    unique: true,
  })
  deviceType: string;
}
