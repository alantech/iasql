---
id: "aws_vpc"
title: "aws_vpc"
displayed_sidebar: "docs"
sidebar_label: "Reference"
sidebar_position: 0
hide_table_of_contents: true
custom_edit_url: null
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="Components" label="Components" default>

### Tables

    [availability_zone](../../classes/aws_vpc_entity_availability_zone.AvailabilityZone)

    [elastic_ip](../../classes/aws_vpc_entity_elastic_ip.ElasticIp)

    [endpoint_gateway](../../classes/aws_vpc_entity_endpoint_gateway.EndpointGateway)

    [endpoint_interface](../../classes/aws_vpc_entity_endpoint_interface.EndpointInterface)

    [internet_gateway](../../classes/aws_vpc_entity_internet_gateway.InternetGateway)

    [nat_gateway](../../classes/aws_vpc_entity_nat_gateway.NatGateway)

    [peering_connection](../../classes/aws_vpc_entity_peering_connection.PeeringConnection)

    [route](../../classes/aws_vpc_entity_route.Route)

    [route_table](../../classes/aws_vpc_entity_route_table.RouteTable)

    [route_table_association](../../classes/aws_vpc_entity_route_table_association.RouteTableAssociation)

    [subnet](../../classes/aws_vpc_entity_subnet.Subnet)

    [vpc](../../classes/aws_vpc_entity_vpc.Vpc)

### Enums
    [endpoint_gateway_service](../../enums/aws_vpc_entity_endpoint_gateway.EndpointGatewayService)

    [endpoint_interface_service](../../enums/aws_vpc_entity_endpoint_interface.EndpointInterfaceService)

    [connectivity_type](../../enums/aws_vpc_entity_nat_gateway.ConnectivityType)

    [nat_gateway_state](../../enums/aws_vpc_entity_nat_gateway.NatGatewayState)

    [peering_connection_state](../../enums/aws_vpc_entity_peering_connection.PeeringConnectionState)

    [subnet_state](../../enums/aws_vpc_entity_subnet.SubnetState)

    [vpc_state](../../enums/aws_vpc_entity_vpc.VpcState)

</TabItem>
  <TabItem value="Code examples" label="Code examples">

```testdoc
modules/aws-vpc-integration.ts#VPC Integration Testing#Manage VPCs
modules/aws-vpc-eip-nat-integration.ts#VPC Elastic IP Integration Testing#Manage Elastic IPs and NAT Gateways
modules/aws-vpc-endpoint-gateway-integration.ts#VPC Integration Testing#Manage Endpoint Gateways
modules/aws-vpc-endpoint-interface-integration.ts#VPC Endpoint interface Integration Testing#Manage Endpoint Interfaces
modules/aws-vpc-routetable-integration.ts#RouteTable Integration Testing#Manage Routing tables
```

</TabItem>
</Tabs>
