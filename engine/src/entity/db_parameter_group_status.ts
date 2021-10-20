import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class DBParameterGroupStatus {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  dbParameterGroupName: string;

  @Column({
    nullable: true,
  })
  parameterApplyStatus: string;
}
