import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity()
export class Cluster {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    unique: true,
  })
  clusterName: string;

  @Column({
    nullable: true,
  })
  clusterArn?: string;

  @Column({
    nullable: true,
  })
  clusterStatus?: string;

}
