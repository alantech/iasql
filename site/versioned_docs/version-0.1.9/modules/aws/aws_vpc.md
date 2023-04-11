---
id: "aws_vpc"
title: "aws_vpc"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs queryString="view">
  <TabItem value="components" label="Components" default>

### Tables

    [availability_zone](../../aws/tables/aws_vpc_entity_availability_zone.AvailabilityZone)

    [dhcp_options](../../aws/tables/aws_vpc_entity_dhcp_options.DhcpOptions)

    [elastic_ip](../../aws/tables/aws_vpc_entity_elastic_ip.ElasticIp)

    [endpoint_gateway](../../aws/tables/aws_vpc_entity_endpoint_gateway.EndpointGateway)

    [endpoint_interface](../../aws/tables/aws_vpc_entity_endpoint_interface.EndpointInterface)

    [internet_gateway](../../aws/tables/aws_vpc_entity_internet_gateway.InternetGateway)

    [nat_gateway](../../aws/tables/aws_vpc_entity_nat_gateway.NatGateway)

    [network_acl](../../aws/tables/aws_vpc_entity_network_acl.NetworkAcl)

    [peering_connection](../../aws/tables/aws_vpc_entity_peering_connection.PeeringConnection)

    [route](../../aws/tables/aws_vpc_entity_route.Route)

    [route_table](../../aws/tables/aws_vpc_entity_route_table.RouteTable)

    [route_table_association](../../aws/tables/aws_vpc_entity_route_table_association.RouteTableAssociation)

    [subnet](../../aws/tables/aws_vpc_entity_subnet.Subnet)

    [vpc](../../aws/tables/aws_vpc_entity_vpc.Vpc)

### Enums
    [endpoint_gateway_service](../../aws/enums/aws_vpc_entity_endpoint_gateway.EndpointGatewayService)

    [endpoint_interface_service](../../aws/enums/aws_vpc_entity_endpoint_interface.EndpointInterfaceService)

    [connectivity_type](../../aws/enums/aws_vpc_entity_nat_gateway.ConnectivityType)

    [nat_gateway_state](../../aws/enums/aws_vpc_entity_nat_gateway.NatGatewayState)

    [peering_connection_state](../../aws/enums/aws_vpc_entity_peering_connection.PeeringConnectionState)

    [subnet_state](../../aws/enums/aws_vpc_entity_subnet.SubnetState)

    [vpc_state](../../aws/enums/aws_vpc_entity_vpc.VpcState)

</TabItem>
  <TabItem value="code-examples" label="Code examples">

```testdoc
modules/aws-vpc-integration.ts#VPC Integration Testing#Manage VPCs
modules/aws-vpc-eip-nat-integration.ts#VPC Elastic IP Integration Testing#Manage Elastic IPs and NAT Gateways
modules/aws-vpc-endpoint-gateway-integration.ts#VPC Integration Testing#Manage Endpoint Gateways
modules/aws-vpc-endpoint-interface-integration.ts#VPC Endpoint interface Integration Testing#Manage Endpoint Interfaces
modules/aws-vpc-routetable-integration.ts#RouteTable Integration Testing#Manage Routing tables
modules/aws-vpc-network-acl-integration.ts#VPC Network ACL Integration Testing#Manage Network ACLs
```

</TabItem>
</Tabs>
