import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class NetworkCardInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'int',
  })
  networkCardIndex: number;

  @Column()
  networkPerformance: string;

  @Column({
    type: 'int',
  })
  maximumNetworkInterfaces: number;
}
