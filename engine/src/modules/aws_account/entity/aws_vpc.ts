import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm'

export enum VpcState {
  AVAILABLE="available",
  PENDING="pending"
};

@Entity()
export class AwsVpc {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  vpcId: string;

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
}