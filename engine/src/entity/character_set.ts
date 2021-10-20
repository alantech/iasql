import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class CharacterSet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  characterSetName: string;

  @Column({
    nullable: true,
  })
  characterSetDescription?: string;
}
