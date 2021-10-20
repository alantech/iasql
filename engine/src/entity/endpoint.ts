import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';
import { noDiff } from '../services/diff';

@Entity()
export class Endpoint {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  address: string;

  @Column({
    type: 'int',
    nullable: true,
  })
  port: number;

  @Column({
    nullable: true,
  })
  hostedZoneId: string;
}
