import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm'

export enum TransportProtocol {
  TCP = "tcp",
  UDP = "udp"
}

@Entity()
export class PortMapping {
  @PrimaryGeneratedColumn()
  id: number;

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
}
