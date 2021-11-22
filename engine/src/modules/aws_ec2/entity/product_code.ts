import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm';

@Entity()
export class ProductCode {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true
  })
  productCodeId?: string;

  @Column({
    nullable: true
  })
  productCodeType?: string;
}
