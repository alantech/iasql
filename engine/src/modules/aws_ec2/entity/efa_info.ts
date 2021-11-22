import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm';

@Entity()
export class EFAInfo {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    type: 'int',
  })
  maximumEFAInterfaces: number;
}
