import { Entity, Column, AfterLoad, AfterInsert, AfterUpdate, PrimaryColumn, Check } from 'typeorm';
import { CpuMemCombination } from '../../aws_ecs_fargate/entity';

@Check(
  `("image_tag" is null and "image_digest" is null) or ("image_tag" is not null and "image_digest" is null) or ("image_tag" is null and "image_digest" is not null)`
)
@Entity()
export class EcsSimplified {
  @Column({
    primary: true,
    unique: true,
    type: 'varchar',
    length: 18,
  })
  appName: string;

  @Column({
    type: 'int',
    default: 1,
  })
  desiredCount: number;

  @Column({ type: 'int' })
  appPort: number;

  @Column({
    type: 'enum',
    enum: CpuMemCombination,
    default: CpuMemCombination['vCPU2-8GB'],
  })
  cpuMem: CpuMemCombination;

  @Column({ nullable: true })
  repositoryUri?: string;

  @Column({ nullable: true })
  imageTag?: string;

  @Column({ nullable: true })
  imageDigest?: string;

  @Column({ default: false })
  publicIp?: boolean;

  @Column({ nullable: true })
  loadBalancerDns?: string;
}
