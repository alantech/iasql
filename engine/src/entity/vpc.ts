import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';
import { awsPrimaryKey } from '../services/aws-primary-key';
import { noDiff } from '../services/diff';
import { Source, source } from '../services/source-of-truth';

export enum VpcState {
  AVAILABLE="available",
  PENDING="pending"
};

@source(Source.DB)
@Entity()
export class Vpc {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  cidrBlock: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: VpcState,
  })
  state?: VpcState;

  @awsPrimaryKey
  @Column({
    nullable: true,
  })
  vpcId?: string;

  @Column({
    nullable: true,
  })
  isDefault?: boolean;
}
