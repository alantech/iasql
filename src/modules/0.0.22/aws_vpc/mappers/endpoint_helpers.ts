import {
  EC2,
  UnsuccessfulItem,
  VpcEndpoint as AwsVpcEndpoint,
  paginateDescribeVpcEndpoints,
  EC2Client,
} from '@aws-sdk/client-ec2';

import { crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { EndpointGatewayService } from '../entity';

export function getServiceFromServiceName(serviceName: string) {
  if (serviceName.includes('s3')) return EndpointGatewayService.S3;
  if (serviceName.includes('dynamodb')) return EndpointGatewayService.DYNAMODB;
}

export const getVpcEndpointGatewayServiceName = crudBuilderFormat<
  EC2,
  'describeVpcEndpointServices',
  string | undefined
>(
  'describeVpcEndpointServices',
  (_service: string) => ({
    Filters: [
      {
        Name: 'service-type',
        Values: ['Gateway'],
      },
    ],
  }),
  (res, service: string) => {
    return res?.ServiceNames?.find(sn => sn.includes(service));
  },
);

export const getVpcEndpointInterfaceServiceName = crudBuilderFormat<
  EC2,
  'describeVpcEndpointServices',
  string | undefined
>(
  'describeVpcEndpointServices',
  (_service: string) => ({
    Filters: [
      {
        Name: 'service-type',
        Values: ['Interface'],
      },
    ],
  }),
  (res, service: string) => {
    return res?.ServiceNames?.find(sn => sn.includes(service));
  },
);

export const createVpcEndpoint = crudBuilderFormat<EC2, 'createVpcEndpoint', AwsVpcEndpoint | undefined>(
  'createVpcEndpoint',
  input => input,
  res => res?.VpcEndpoint,
);

export const getVpcEndpoint = crudBuilderFormat<EC2, 'describeVpcEndpoints', AwsVpcEndpoint | undefined>(
  'describeVpcEndpoints',
  endpointId => ({ VpcEndpointIds: [endpointId] }),
  res => res?.VpcEndpoints?.pop(),
);

export const getVpcEndpointGateways = paginateBuilder<EC2>(
  paginateDescribeVpcEndpoints,
  'VpcEndpoints',
  undefined,
  undefined,
  () => ({
    Filters: [
      {
        Name: 'vpc-endpoint-type',
        Values: ['Gateway'],
      },
      // vpc-endpoint-state - The state of the endpoint:
      // pendingAcceptance | pending | available | deleting | deleted | rejected | failed
      {
        Name: 'vpc-endpoint-state',
        Values: ['available', 'rejected', 'failed'],
      },
    ],
  }),
);

export const getVpcEndpointInterfaces = paginateBuilder<EC2>(
  paginateDescribeVpcEndpoints,
  'VpcEndpoints',
  undefined,
  undefined,
  () => ({
    Filters: [
      {
        Name: 'vpc-endpoint-type',
        Values: ['Interface'],
      },
      // vpc-endpoint-state - The state of the endpoint:
      // pendingAcceptance | pending | available | deleting | deleted | rejected | failed
      {
        Name: 'vpc-endpoint-state',
        Values: ['available', 'rejected', 'failed'],
      },
    ],
  }),
);

export const modifyVpcEndpoint = crudBuilderFormat<EC2, 'modifyVpcEndpoint', boolean | undefined>(
  'modifyVpcEndpoint',
  input => input,
  res => res?.Return,
);

export const deleteVpcEndpoint = crudBuilderFormat<EC2, 'deleteVpcEndpoints', UnsuccessfulItem[] | undefined>(
  'deleteVpcEndpoints',
  endpointId => ({ VpcEndpointIds: [endpointId] }),
  res => res?.Unsuccessful,
);
