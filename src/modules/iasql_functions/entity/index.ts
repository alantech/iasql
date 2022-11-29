import { CreateDateColumn, Column, Entity, PrimaryColumn, Index } from 'typeorm';

@Entity()
export class IasqlRpc {
  @PrimaryColumn({
    type: 'uuid',
  })
  opid: string;

  @Index('IDX_rpc_start_date')
  @CreateDateColumn({
    type: 'timestamptz',
  })
  startDate: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  endDate: Date;

  @Column({ type: 'text' })
  moduleName: string;

  @Column({ type: 'text' })
  methodName: string;

  @Column({
    type: 'text',
    array: true,
  })
  params: string[];

  @Column({
    type: 'text',
    nullable: true,
  })
  output: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  err: string;
}
