import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm';

@Entity()
export class FPGADeviceMemoryInfo {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    type: 'decimal',
  })
  sizeInMiB: number;
}
