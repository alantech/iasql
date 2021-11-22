import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm';

@Entity()
export class UsageClass {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    unique: true,
  })
  usageClass: string;
}
