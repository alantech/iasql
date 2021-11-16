import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm';

@Entity()
export class BootMode {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    unique: true,
  })
  mode: string;
}
