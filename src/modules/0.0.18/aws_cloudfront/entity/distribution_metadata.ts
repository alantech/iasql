import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToOne, } from 'typeorm'

import { Distribution, } from '.'

export enum distributionStatusEnum {
    IN_PROGRESS = "InProgress",
    DEPLOYED = "Deployed",
}
    
@Entity()
export class DistributionMetadata {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Distribution, { nullable: false, eager: true })
  @JoinColumn({
    name: 'distribution_id',
  })
  distribution: Distribution;

  @Column({
    nullable: true,
  })
  ARN?: string;

  @Column({
    nullable: true,
  })
  domainName?: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: distributionStatusEnum,
  })
  status?: distributionStatusEnum;
}
