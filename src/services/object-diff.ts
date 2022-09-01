import { isObject, isString } from './common';

function isStringArray(obj: unknown): obj is string[] {
  return Array.isArray(obj) && obj.every(isString);
}

enum IAM_KEY {
  Version = 'Version',
  Statement = 'Statement',
  Effect = 'Effect',
  Principal = 'Principal',
  Action = 'Action',
  Resource = 'Resource',
  Sid = 'Sid',
  Condition = 'Condition',
}

// Returns true if the objects are the same, and false if they aren't
export function objectsAreSame(obj1: any = {}, obj2: any = {}): boolean {
  // One is array of a single string and the other is string
  if (isStringArray(obj1) && obj1.length === 1 && isString(obj2)) return obj1[0] === obj2;
  if (isStringArray(obj2) && obj2.length === 1 && isString(obj1)) return obj2[0] === obj1;

  // Both are array of strings
  if (isStringArray(obj1) && isStringArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    obj1.sort();
    obj2.sort();
    return obj1.every((element, i) => element === obj2[i]);
  }

  // From https://stackoverflow.com/questions/44792629/how-to-compare-two-objects-with-nested-array-of-object-using-loop
  let same = Object.keys(obj1).length === Object.keys(obj2).length;
  if (!same) return same;

  for (const key of Object.keys(obj1)) {
    if (isObject(obj1[key])) {
      same = objectsAreSame(obj1[key], obj2[key]);
    } else {
      if (obj1[key] !== obj2[key]) {
        same = false;
      }
    }

    if (!same) break;
  }
  return same;
}

// Returns true if the policies mean the same thing (regardless of structure), and false if they aren't
export function policiesAreSame(obj1: any, obj2: any): boolean {
  if (Array.isArray(obj1) && obj1.length === 1) return policiesAreSame(obj1[0], obj2);
  if (Array.isArray(obj2) && obj2.length === 1) return policiesAreSame(obj1, obj2[0]);

  let same = Object.keys(obj1).length === Object.keys(obj2).length;
  if (!same) return same;

  same = true;
  for (const key of Object.keys(obj1)) {
    switch (key) {
      // Can be String-only
      case IAM_KEY.Version:
      case IAM_KEY.Effect:
      case IAM_KEY.Sid:
        if (obj1[key] !== obj2[key]) {
          same = false;
        }
        break;
      // Can be an array of single object or just an object
      case IAM_KEY.Statement:
        same = policiesAreSame(obj1[key], obj2[key]);
        break;
      // Can be JSON or string
      case IAM_KEY.Principal:
      // Can be string or array of strings
      case IAM_KEY.Action:
      case IAM_KEY.Resource:
      // Can only be JSON
      case IAM_KEY.Condition:
      default:
        if (isString(obj1[key]) && isString(obj2[key]) && obj1[key] !== obj2[key]) {
          same = false;
          break;
        }

        same = objectsAreSame(obj1[key], obj2[key]);
        break;
    }

    // If we've found a difference, stop looping.
    if (!same) break;
  }

  return same;
}
