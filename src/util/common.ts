export function isStringArray(obj: unknown): obj is string[] {
  return Array.isArray(obj) && obj.every(isString);
}

export function isString(obj: unknown): obj is string {
  return typeof obj === 'string';
}

export function isObject(obj: unknown): obj is object {
  return typeof obj === 'object';
}
