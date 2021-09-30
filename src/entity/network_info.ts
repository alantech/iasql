import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  JoinColumn,
  ManyToOne,
} from 'typeorm';

import { EFAInfo, } from './efa_info';
import { NetworkCardInfo, } from './network_card_info';
import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

export enum ENASupport {
  REQUIRED = 'required',
  SUPPORTED = 'supported',
  UNSUPPORTED = 'unsupported',
}

@source(Source.AWS)
@Entity()
export class NetworkInfo {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  networkPerformance: string;

  @Column({
    type: 'int',
  })
  maximumNetworkInterfaces: number;

  @Column({
    type: 'int',
  })
  maximumNetworkCards: number;

  @Column({
    type: 'int',
  })
  defaultNetworkCardIndex: number;

  @ManyToMany(() => NetworkCardInfo, { cascade: true })
  @JoinTable()
  networkCards: NetworkCardInfo[];

  @Column({
    type: 'int',
  })
  ipv4AddressesPerInterface: number;

  @Column({
    type: 'int',
  })
  ipv6AddressesPerInterface: number;

  @Column()
  ipv6Supported: boolean;

  @Column({
    type: 'enum',
    enum: ENASupport,
  })
  enaSupport: ENASupport;

  @Column()
  efaSupported: boolean;

  @ManyToOne(() => EFAInfo, { cascade: true })
  @JoinColumn({
    name: 'efa_info_id',
  })
  efaInfo: EFAInfo;

  @Column()
  encryptionInTransitSupported: boolean;
}
