---
sidebar_position: 7
slug: '/ami'
---

# Get latest AMI ID

Invoke the AWS [SSM](https://docs.aws.amazon.com/cli/latest/reference/ssm/index.html) via the [CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) to get the latest AMI ids

:::caution

AMI ids in AWS are different per region for the same AMI type so make sure to use the correct region

:::

```bash {7} {16}
aws ssm get-parameters-by-path --path "/aws/service/ami-amazon-linux-latest" --region us-east-2
{
    "Parameters": [
        {
            "Name": "/aws/service/ami-amazon-linux-latest/amzn-ami-hvm-x86_64-ebs",
            "Type": "String",
            "Value": "ami-03879af58f5fd01f7",
            "Version": 36,
            "LastModifiedDate": "2021-12-23T13:50:05.725000-08:00",
            "ARN": "arn:aws:ssm:us-east-2::parameter/aws/service/ami-amazon-linux-latest/amzn-ami-hvm-x86_64-ebs",
            "DataType": "text"
        },
        {
            "Name": "/aws/service/ami-amazon-linux-latest/amzn-ami-hvm-x86_64-gp2",
            "Type": "String",
            "Value": "ami-0fdffa9be142bf7f4",
            "Version": 36,
            "LastModifiedDate": "2021-12-23T13:50:05.839000-08:00",
            "ARN": "arn:aws:ssm:us-east-2::parameter/aws/service/ami-amazon-linux-latest/amzn-ami-hvm-x86_64-gp2",
            "DataType": "text"
        },
        ...
    ]
}
```