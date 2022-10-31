import {
  EC2,
  UnsuccessfulItem,
  VpcEndpoint as AwsVpcEndpoint,
  paginateDescribeVpcEndpoints,
  EC2Client,
} from '@aws-sdk/client-ec2';

import { AwsVpcModule } from '..';
import { crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { EndpointGatewayService } from '../entity';

export function getServiceFromServiceName(serviceName: string) {
  if (serviceName.includes('s3')) return EndpointGatewayService.S3;
  if (serviceName.includes('dynamodb')) return EndpointGatewayService.DYNAMODB;
}

export async function getVpcEndpointServiceName(client: EC2Client, serviceType: string) {
  return await crudBuilderFormat<EC2, 'describeVpcEndpointServices', string | undefined>(
    'describeVpcEndpointServices',
    (_service: string) => ({
      Filters: [
        {
          Name: 'service-type',
          Values: [serviceType],
        },
      ],
    }),
    (res, service: string) => res?.ServiceNames?.find(sn => sn.includes(service)),
  );
}

export async function createVpcEndpoint(input: any) {
  return crudBuilderFormat<EC2, 'createVpcEndpoint', AwsVpcEndpoint | undefined>(
    'createVpcEndpoint',
    input => input,
    res => res?.VpcEndpoint,
  );
}

export async function getVpcEndpoint(endpointId: any) {
  return crudBuilderFormat<EC2, 'describeVpcEndpoints', AwsVpcEndpoint | undefined>(
    'describeVpcEndpoints',
    endpointId => ({ VpcEndpointIds: [endpointId] }),
    res => res?.VpcEndpoints?.pop(),
  );
}

export async function getVpcEndpoints(serviceType: string) {
  return paginateBuilder<EC2>(paginateDescribeVpcEndpoints, 'VpcEndpoints', undefined, undefined, () => ({
    Filters: [
      {
        Name: 'vpc-endpoint-type',
        Values: [serviceType],
      },
      // vpc-endpoint-state - The state of the endpoint:
      // pendingAcceptance | pending | available | deleting | deleted | rejected | failed
      {
        Name: 'vpc-endpoint-state',
        Values: ['available', 'rejected', 'failed'],
      },
    ],
  }));
}
export async function modifyVpcEndpoint(inputy: any) {
  return crudBuilderFormat<EC2, 'modifyVpcEndpoint', boolean | undefined>(
    'modifyVpcEndpoint',
    input => input,
    res => res?.Return,
  );
}

export async function deleteVpcEndpoint(endpointId: string) {
  return crudBuilderFormat<EC2, 'deleteVpcEndpoints', UnsuccessfulItem[] | undefined>(
    'deleteVpcEndpoints',
    endpointId => ({ VpcEndpointIds: [endpointId] }),
    res => res?.Unsuccessful,
  );
}
