import _ from 'lodash';

import { normalizePolicy, Policy } from './canonical-iam-policy';
import { isString } from './common';

function isStringArray(obj: unknown): obj is string[] {
  return Array.isArray(obj) && obj.every(isString);
}

function isObject(obj: unknown): obj is object {
  return typeof obj === 'object';
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
  let same =
    Object.keys(obj1).filter(key => obj1[key] !== undefined).length ===
    Object.keys(obj2).filter(key => obj2[key] !== undefined).length;
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
export function policiesAreSame(obj1: Policy | undefined, obj2: Policy | undefined): boolean {
  if (!obj1 || !obj2) return obj1 === obj2;

  const normObj1 = normalizePolicy(obj1),
    normObj2 = normalizePolicy(obj2);
  return _.isEqual(normObj1, normObj2);
}
