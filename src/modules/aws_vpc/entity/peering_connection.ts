import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { Vpc } from './vpc';

/**
 * @enum
 * Different states for a peering connection. A valid peering connection should be in ACTIVE state
 */
export enum PeeringConnectionState {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  FAILED = 'failed',
  INITIATING_REQUEST = 'initiating-request',
  PENDING_ACCEPTANCE = 'pending-acceptance',
  PROVISIONING = 'provisioning',
  REJECTED = 'rejected',
}

@Entity()
export class PeeringConnection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  @cloudId
  peeringConnectionId?: string;

  @ManyToOne(() => Vpc, {
    nullable: false,
    eager: true,
  })
  @JoinColumn()
  requester: Vpc;

  @ManyToOne(() => Vpc, {
    nullable: false,
    eager: true,
  })
  @JoinColumn()
  accepter: Vpc;

  @Column({
    nullable: true,
    type: 'enum',
    enum: PeeringConnectionState,
  })
  state?: PeeringConnectionState;

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };
}
