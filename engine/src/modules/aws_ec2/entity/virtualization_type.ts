import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm';

@Entity()
export class VirtualizationType {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    unique: true,
  })
  virtualizationType: string;
}
