import {
  Entity,
  PrimaryColumn,
} from 'typeorm'

import { cloudId, } from '../../../../services/cloud-id' // This is ridiculous. Can we fix this?

@Entity({
  name: 'availability_zone',
})
export class AvailabilityZone {
  @PrimaryColumn()
  @cloudId
  name: string;
}
