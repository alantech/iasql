import {Entity, PrimaryGeneratedColumn, Column} from "typeorm";

import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

@source(Source.DB)
@Entity()
export class Tag {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  key: string;

  @Column()
  value: string;
}
