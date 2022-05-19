import {
  Entity,
  Column,
  AfterLoad,
  AfterInsert,
  AfterUpdate,
  PrimaryColumn,
  Check,
} from 'typeorm'
import { CpuMemCombination } from '../../aws_ecs_fargate/entity';

@Check(`("image_tag" is null and "image_digest" is null) or ("image_tag" is not null and "image_digest" is null) or ("image_tag" is null and "image_digest" is not null)`)
@Entity()
export class EcsSimplified {

  @Column({ unique: true, type: 'varchar', length: 18, primary: true, })
  appName: string;

  @Column({
    type: 'int',
    nullable: true,
  })
  desiredCount?: number;

  @Column({ type: 'int', })
  appPort: number;

  @Column({
    nullable: true,
    type: 'enum',
    enum: CpuMemCombination,
  })
  cpuMem?: CpuMemCombination;

  @Column({ nullable: true, })
  repositoryUri?: string;

  @Column({ nullable: true, })
  imageTag?: string;

  @Column({ nullable: true, })
  imageDigest?: string;

  @Column({ default: false, })
  publicIp?: boolean;

  @Column({ nullable: true, })
  loadBalancerDns?: string;

  @AfterLoad()
  @AfterInsert()
  @AfterUpdate()
  updateNulls() {
    const that: any = this;
    Object.keys(this).forEach(k => {
      if (that[k] === null) that[k] = undefined;
    });
  }

}
