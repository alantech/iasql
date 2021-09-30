import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class GPUDeviceMemoryInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'decimal',
  })
  sizeInMiB: number;
}
