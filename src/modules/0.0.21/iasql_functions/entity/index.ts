import { CreateDateColumn, Column, Entity, PrimaryColumn, Index } from 'typeorm';

// ! DEPRECATED
// TODO: REMOVE BY THE TIME 0.0.20 BECOMES UNSUPPORTED
export enum IasqlOperationType {
  APPLY = 'APPLY',
  SYNC = 'SYNC',
  INSTALL = 'INSTALL',
  UNINSTALL = 'UNINSTALL',
  PLAN_APPLY = 'PLAN_APPLY',
  PLAN_SYNC = 'PLAN_SYNC',
  LIST = 'LIST',
  UPGRADE = 'UPGRADE',
}

// ! DEPRECATED
// TODO: REMOVE BY THE TIME 0.0.20 BECOMES UNSUPPORTED
@Entity()
export class IasqlOperation {
  @PrimaryColumn({
    type: 'uuid',
  })
  opid: string;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  startDate: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: IasqlOperationType,
  })
  optype: IasqlOperationType;

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
