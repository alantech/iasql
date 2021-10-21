import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, } from 'typeorm';
import { ContainerDefinition } from '.';
import { awsPrimaryKey } from '../services/aws-primary-key';

import { source, Source } from '../services/source-of-truth';
import { Compatibility } from './compatibility';

export enum NetworkMode {
  AWSVPC = "awsvpc",
  BRIDGE = "bridge",
  HOST = "host",
  NONE = "none"
}

export enum TaskDefinitionStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE"
}

@source(Source.DB)
@Entity()
export class TaskDefinition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  taskDefinitionArn?: string;

  @ManyToMany(() => ContainerDefinition, { cascade: true, eager: true, })
  @JoinTable()
  containerDefinitions?: ContainerDefinition[];

  @Column()
  family: string;

  @Column({
    nullable: true,
    type: 'int',
  })
  revision?: number;

  // Generated column to index properly
  @awsPrimaryKey
  @Column()
  familyRevision: string;

  @Column({
    nullable: true,
  })
  taskRoleArn?: string;

  @Column({
    nullable: true,
  })
  executionRoleArn?: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: NetworkMode,
  })
  networkMode?: NetworkMode;

  @Column({
    nullable: true,
    type: 'enum',
    enum: TaskDefinitionStatus,
  })
  status?: TaskDefinitionStatus;

  @ManyToMany(() => Compatibility, { cascade: true, eager: true, })
  @JoinTable()
  requiresCompatibilities?: Compatibility[];

  // TODO: add constraint
  // * <p>The number of <code>cpu</code> units used by the task. If you are using the EC2 launch
  // * 			type, this field is optional and any value can be used. If you are using the Fargate
  // * 			launch type, this field is required and you must use one of the following values, which
  // * 			determines your range of valid values for the <code>memory</code> parameter:</p>
  // * 		       <ul>
  // *             <li>
  // *                 <p>256 (.25 vCPU) - Available <code>memory</code> values: 512 (0.5 GB), 1024 (1 GB), 2048 (2 GB)</p>
  // *             </li>
  // *             <li>
  // *                 <p>512 (.5 vCPU) - Available <code>memory</code> values: 1024 (1 GB), 2048 (2 GB), 3072 (3 GB), 4096 (4 GB)</p>
  // *             </li>
  // *             <li>
  // *                 <p>1024 (1 vCPU) - Available <code>memory</code> values: 2048 (2 GB), 3072 (3 GB), 4096 (4 GB), 5120 (5 GB), 6144 (6 GB), 7168 (7 GB), 8192 (8 GB)</p>
  // *             </li>
  // *             <li>
  // *                 <p>2048 (2 vCPU) - Available <code>memory</code> values: Between 4096 (4 GB) and 16384 (16 GB) in increments of 1024 (1 GB)</p>
  // *             </li>
  // *             <li>
  // *                 <p>4096 (4 vCPU) - Available <code>memory</code> values: Between 8192 (8 GB) and 30720 (30 GB) in increments of 1024 (1 GB)</p>
  // *             </li>
  // *          </ul>
  @Column({
    nullable: true,
  })
  cpu?: string;

  // TODO: Add constraint
  //  * <p>The amount (in MiB) of memory used by the task.</p>
  //  * 		       <p>If your tasks will be run on Amazon EC2 instances, you must specify either a task-level
  //  * 			memory value or a container-level memory value. This field is optional and any value can
  //  * 			be used. If a task-level memory value is specified then the container-level memory value
  //  * 			is optional. For more information regarding container-level memory and memory
  //  * 			reservation, see <a href="https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_ContainerDefinition.html">ContainerDefinition</a>.</p>
  //  * 		       <p>If your tasks will be run on Fargate, this field is required and you must use one of
  //  * 			the following values, which determines your range of valid values for the
  //  * 				<code>cpu</code> parameter:</p>
  //  *          <ul>
  //  *             <li>
  //  *                 <p>512 (0.5 GB), 1024 (1 GB), 2048 (2 GB) - Available <code>cpu</code> values: 256 (.25 vCPU)</p>
  //  *             </li>
  //  *             <li>
  //  *                 <p>1024 (1 GB), 2048 (2 GB), 3072 (3 GB), 4096 (4 GB) - Available <code>cpu</code> values: 512 (.5 vCPU)</p>
  //  *             </li>
  //  *             <li>
  //  *                 <p>2048 (2 GB), 3072 (3 GB), 4096 (4 GB), 5120 (5 GB), 6144 (6 GB), 7168 (7 GB), 8192 (8 GB) - Available <code>cpu</code> values: 1024 (1 vCPU)</p>
  //  *             </li>
  //  *             <li>
  //  *                 <p>Between 4096 (4 GB) and 16384 (16 GB) in increments of 1024 (1 GB) - Available <code>cpu</code> values: 2048 (2 vCPU)</p>
  //  *             </li>
  //  *             <li>
  //  *                 <p>Between 8192 (8 GB) and 30720 (30 GB) in increments of 1024 (1 GB) - Available <code>cpu</code> values: 4096 (4 vCPU)</p>
  //  *             </li>
  //  *          </ul>
  @Column({
    nullable: true,
  })
  memory?: string;
}
