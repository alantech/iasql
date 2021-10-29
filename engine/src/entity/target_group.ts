import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Vpc, } from '.'
import { awsPrimaryKey } from '../services/aws-primary-key';
import { noDiff, } from '../services/diff'
import { Source, source, } from '../services/source-of-truth'

export enum TargetTypeEnum {
  ALB = "alb",
  INSTANCE = "instance",
  IP = "ip",
  LAMBDA = "lambda"
}

export enum TargetGroupIpAddressTypeEnum {
  IPV4 = "ipv4",
  IPV6 = "ipv6"
}

export enum ProtocolEnum {
  GENEVE = "GENEVE",
  HTTP = "HTTP",
  HTTPS = "HTTPS",
  TCP = "TCP",
  TCP_UDP = "TCP_UDP",
  TLS = "TLS",
  UDP = "UDP"
}

export enum ProtocolVersionEnum {
  GRPC = "GRPC",
  HTTP1 = "HTTP1",
  HTTP2 = "HTTP2"
}

@source(Source.DB)
@Entity()
export class TargetGroup {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @noDiff
  @Column({
    unique: true,
  })
  targetGroupName: string;

  @noDiff
  @Column({
    type: 'enum',
    enum: TargetTypeEnum,
  })
  targetType: TargetTypeEnum;

  @awsPrimaryKey
  @noDiff
  @Column({
    nullable: true,
  })
  targetGroupArn?: string;

  @noDiff
  @Column({
    nullable: true,
    type: 'enum',
    enum: TargetGroupIpAddressTypeEnum,
  })
  ipAddressType?: TargetGroupIpAddressTypeEnum;

  @noDiff
  @Column({
    nullable: true,
    type: 'enum',
    enum: ProtocolEnum,
  })
  protocol?: ProtocolEnum;

  @noDiff
  @Column({
    nullable: true,
    type: 'int',
  })
  port?: number;

  @noDiff
  @ManyToOne(() => Vpc, { eager: true, })
  @JoinColumn({ name: 'vpc_id', })
  vpc?: Vpc;

  @Column({
    nullable: true,
    type: 'enum',
    enum: ProtocolEnum,
  })
  healthCheckProtocol?: ProtocolEnum;

  @Column({
    nullable: true,
  })
  healthCheckPort?: string;

  @Column({
    nullable: true,
  })
  healthCheckEnabled?: boolean;

  @Column({
    nullable: true,
    type: 'int',
  })
  healthCheckIntervalSeconds?: number;

  @Column({
    nullable: true,
    type: 'int',
  })
  healthCheckTimeoutSeconds?: number;

  @Column({
    nullable: true,
    type: 'int',
  })
  healthyThresholdCount?: number;

  @Column({
    nullable: true,
    type: 'int',
  })
  unhealthyThresholdCount?: number;

  @Column({
    nullable: true,
  })
  healthCheckPath?: string;

  @noDiff
  @Column({
    nullable: true,
    type: 'enum',
    enum: ProtocolVersionEnum,
  })
  protocolVersion?: ProtocolVersionEnum;

}
