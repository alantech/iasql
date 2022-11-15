import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

@Entity()
@Unique('uq_cluster_name_region', ['clusterName', 'region'])
export class Cluster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  clusterName: string;

  @Column({
    nullable: true,
  })
  @cloudId
  clusterArn?: string;

  @Column({
    nullable: true,
  })
  clusterStatus?: string;

  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;
}
