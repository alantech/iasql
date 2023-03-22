import { RDS, Tag as AWSTag } from '@aws-sdk/client-rds';

export const updateTags = async (client: RDS, resourceId: string, tags?: { [key: string]: string }) => {
  let tgs: AWSTag[] = [];
  if (tags) {
    tgs = Object.keys(tags).map(k => {
      return {
        Key: k,
        Value: tags[k],
      };
    });
  }
  // recreate tags
  await client.removeTagsFromResource({
    ResourceName: resourceId,
    TagKeys: Object.keys(tags ?? {}),
  });
  await client.addTagsToResource({
    ResourceName: resourceId,
    Tags: tgs,
  });
};
