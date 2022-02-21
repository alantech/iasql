import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm'

@Entity()
export class LogGroup {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    unique: true,
  })
  logGroupName: string;

  @Column({
    nullable: true,
  })
  logGroupArn?: string;

  @Column({
    nullable: true,
    type: 'timestamp with time zone',
  })
  creationTime?: Date;

}
