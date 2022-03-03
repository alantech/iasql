import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { AwsContainerDefinition } from '.';

export enum TransportProtocol {
  TCP = "tcp",
  UDP = "udp"
}

@Entity()
export class PortMapping {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true,
    type: 'int',
  })
  containerPort: number;

  @Column({
    nullable: true,
    type: 'int',
  })
  hostPort: number;

  @Column({
    type: 'enum',
    enum: TransportProtocol,
  })
  protocol: TransportProtocol;

  @ManyToOne(() => AwsContainerDefinition)
  @JoinColumn({
    name: 'container_definition_id',
  })
  containerDefinition: AwsContainerDefinition;
}
