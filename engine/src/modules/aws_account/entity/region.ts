import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm';

@Entity()
export class Region {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  name: string;

  @Column()
  endpoint: string;

  @Column()
  optInStatus: string;
}
