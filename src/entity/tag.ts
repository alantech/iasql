import {Entity, PrimaryGeneratedColumn, Column} from "typeorm";

@Entity()
export class Tag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  key: string;

  @Column()
  value: string;
}
