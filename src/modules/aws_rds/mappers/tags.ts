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

export function eqTags(a: { [key: string]: string } | undefined, b: { [key: string]: string } | undefined) {
  return (
    Object.is(Object.keys(a ?? {})?.length, Object.keys(b ?? {})?.length) &&
    Object.keys(a ?? {})?.every(ak => (a ?? {})[ak] === (b ?? {})[ak])
  );
}
