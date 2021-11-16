import { Column, Entity, PrimaryGeneratedColumn, } from "typeorm";

// TODO: Where does this *actually* belong? AWS has tags in lots of places, but are they actually
// universal, or are there different tag implementations for different things?
@Entity()
export class Tag {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  key: string;

  @Column()
  value: string;
}
