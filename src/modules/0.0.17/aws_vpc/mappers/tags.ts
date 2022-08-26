import { EC2, Tag } from '@aws-sdk/client-ec2';
import isEqual from 'lodash.isequal';

export function eqTags(a: { [key: string]: string } | undefined, b: { [key: string]: string } | undefined) {
  return isEqual(a, b);
}

// TODO: Figure out if/how to macro-ify this thing
export async function updateTags(client: EC2, resourceId: string, tags?: { [key: string]: string }) {
  let tgs: Tag[] = [];
  if (tags) {
    tgs = Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));
  }
  // recreate tags
  await client.deleteTags({
    Resources: [resourceId],
  });
  await client.createTags({
    Resources: [resourceId],
    Tags: tgs,
  });
}
