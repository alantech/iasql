import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class Timezone {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  name: string;
}
