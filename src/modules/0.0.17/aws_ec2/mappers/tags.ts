import {
  EC2,
  Tag as AWSTag,
} from '@aws-sdk/client-ec2'

// TODO: Macro-ify this somehow?
export const updateTags = async (client: EC2, resourceId: string, tags?: { [key: string] : string }) => {
  let tgs: AWSTag[] = [];
  if (tags) {
    tgs = Object.keys(tags).map(k => {
      return {
        Key: k, Value: tags[k]
      }
    });
  }
  // recreate tags
  await client.deleteTags({
    Resources: [resourceId],
  });
  await client.createTags({
    Resources: [resourceId],
    Tags: tgs,
  })
}

export function eqTags(
  a: { [key: string]: string } | undefined,
  b: { [key: string]: string } | undefined
) {
  return Object.is(Object.keys(a ?? {})?.length, Object.keys(b ?? {})?.length) &&
    Object.keys(a ?? {})?.every(ak => (a ?? {})[ak] === (b ?? {})[ak]);
}
