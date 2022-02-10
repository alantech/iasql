import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm'

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

@Entity()
export class AwsTargetGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  targetGroupName: string;

  @Column({
    type: 'enum',
    enum: TargetTypeEnum,
  })
  targetType: TargetTypeEnum;

  @Column({
    nullable: true,
  })
  targetGroupArn?: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: TargetGroupIpAddressTypeEnum,
  })
  ipAddressType?: TargetGroupIpAddressTypeEnum;

  @Column({
    nullable: true,
    type: 'enum',
    enum: ProtocolEnum,
  })
  protocol?: ProtocolEnum;

  @Column({
    nullable: true,
    type: 'int',
  })
  port?: number;

  vpc: string;

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

  @Column({
    nullable: true,
    type: 'enum',
    enum: ProtocolVersionEnum,
  })
  protocolVersion?: ProtocolVersionEnum;

}