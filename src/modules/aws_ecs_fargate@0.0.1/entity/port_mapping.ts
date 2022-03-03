import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { ContainerDefinition } from '../../aws_ecs@0.0.1/entity';

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

  @ManyToOne(() => ContainerDefinition)
  @JoinColumn({
    name: 'container_definition_id',
  })
  containerDefinition: ContainerDefinition;
}
