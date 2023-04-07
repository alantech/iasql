import isEqual from 'lodash.isequal';

import { EC2, Tag } from '@aws-sdk/client-ec2';

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

export function convertTagsFromAws(inputTags?: Tag[]): { [key: string]: any } {
  const tags: { [key: string]: any } = {};
  (inputTags || [])
    .filter(t => t.hasOwnProperty('Key') && t.hasOwnProperty('Value'))
    .forEach(t => {
      tags[t.Key as string] = t.Value;
    });
  return tags;
}

export function convertTagsForAws(tags: { [key: string]: string }) {
  return Object.keys(tags).map(k => {
    return {
      Key: k,
      Value: tags[k],
    };
  });
}
