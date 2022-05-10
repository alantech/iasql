import {
  Entity,
  Column,
  AfterLoad,
  AfterInsert,
  AfterUpdate,
  PrimaryColumn,
} from 'typeorm'
import { CpuMemCombination } from '../../aws_ecs_fargate/entity';

@Entity()
export class EcsQuickstart {

  @Column({ unique: true, })
  @PrimaryColumn()
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
  repository?: string;

  @Column({ nullable: true, })
  tag?: string;

  @Column({ nullable: true, })
  digest?: string;

  @Column({ nullable: true, })
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
