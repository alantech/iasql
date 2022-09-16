import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';

export enum Protocol {
  HTTP = 'HTTP',
  WEBSOCKET = 'WEBSOCKET',
}

@Entity()
export class Api {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true,
  })
  @cloudId
  apiId: string;

  @Column({
    nullable: true,
  })
  name?: string;

  @Column({
    nullable: true,
  })
  description?: string;

  @Column({
    nullable: true,
  })
  disableExecuteApiEndpoint?: boolean;

  @Column({
    type: 'enum',
    enum: Protocol,
    nullable: true,
  })
  protocolType?: Protocol;

  @Column({
    nullable: true,
  })
  version?: string;
}
