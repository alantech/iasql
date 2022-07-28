import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { cloudId, } from '../../../../services/cloud-id'

export enum VpcState {
  AVAILABLE = 'available',
  PENDING = 'pending',
}

@Entity()
export class Vpc {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  @Index({ unique: true, where: "vpc_id IS NOT NULL" })
  @cloudId
  vpcId?: string;

  @Column()
  cidrBlock: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: VpcState,
  })
  state?: VpcState;

  @Column({
    default: false,
  })
  isDefault: boolean;

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

}
