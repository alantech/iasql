import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';


@Entity()
export class IPRange {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  status?: string;

  @Column({
    nullable: true,
    type: 'cidr'
  })
  cidrip?: string;
}
