import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm'
import { Action, ELB, } from '.'
import { ProtocolEnum } from './target_group';
import { awsPrimaryKey } from '../services/aws-primary-key';
import { noDiff, } from '../services/diff'
import { Source, source, } from '../services/source-of-truth'

@source(Source.DB)
@Entity()
export class Listener {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @awsPrimaryKey
  @Column({
    nullable: true,
  })
  listenerArn?: string;

  @noDiff
  @ManyToOne(() => ELB, { eager: true, })
  @JoinColumn({
    name: 'elb_id',
  })
  elb: ELB;

  @Column({
    type: 'integer',
  })
  port: number;

  @Column({
    type: 'enum',
    enum: ProtocolEnum,
  })
  protocol: ProtocolEnum;

  @noDiff
  @ManyToMany(() => Action, { cascade: true, eager: true, })
  @JoinTable()
  defaultActions?: Action[];

  // TODO: to be defined
  // Certificates?: Certificate[];
  // SslPolicy?: string;
  // AlpnPolicy?: string[];
}
