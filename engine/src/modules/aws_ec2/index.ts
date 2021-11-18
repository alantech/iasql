import { In, } from 'typeorm'

import { Repository, } from '@aws-sdk/client-ecr'

import { AWS, } from '../../services/gateways/aws'
import { } from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsEc21637043091787, } from './migration/1637043091787-aws_ec2'

export const AwsEc2Module: Module = new Module({
  name: 'aws_ec2',
});