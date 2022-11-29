import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

@Entity()
@Index(['logGroupName', 'region'], { unique: true })
export class LogGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @cloudId
  @Column()
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

  @cloudId
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;
}
