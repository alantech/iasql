export function generateResourceName(prefix: string, appName: string, entityClassName: string) {
  const suffix = {
    SecurityGroup: '-sg',
    SecurityGroupRule: '-sgr',
    TargetGroup: '-tg',
    LoadBalancer: '-lb',
    Listener: '-lsn',
    LogGroup: '-lg',
    Repository: '-ecr',
    Role: '-rl',
    Cluster: '-cl',
    TaskDefinition: '-td',
    ContainderDefinition: '-cd',
    Service: '-svc',
  }[entityClassName] ?? '';
  return `${prefix}${appName}${suffix}`;
};

export function processImageFromString(image: string) {
  const res: {
    repositoryUri?: string,
    tag?: string,
    digest?: string,
    isPrivateEcr?: boolean,
    isPublicEcr?: boolean,
    ecrRepositoryName?: string,
  } = {};
  if (image?.includes('@')) {  // Image with digest
    const split = image.split('@');
    res.repositoryUri = split[0];
    res.digest = split[1];
  } else if (image?.includes(':')) {  // Image with tag
    const split = image.split(':');
    res.repositoryUri = split[0];
    res.tag = split[1];
  } else {  // Just image name
    res.repositoryUri = image;
  }
  if (res.repositoryUri?.includes('amazonaws.com')) {  // Private ECR
    const parts = res.repositoryUri.split('/');
    const repositoryName = parts[parts.length - 1] ?? null;
    res.ecrRepositoryName = repositoryName;
    res.isPrivateEcr = true;
  } else if (res.repositoryUri?.includes('public.ecr.aws')) {  // Public ECR
    const parts = res.repositoryUri.split('/');
    const publicRepositoryName = parts[parts.length - 1] ?? null;
    res.ecrRepositoryName = publicRepositoryName;
    res.isPublicEcr = true;
  }
  return res;
}
