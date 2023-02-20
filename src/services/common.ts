export function isString(obj: unknown): obj is string {
  return typeof obj === 'string';
}

export const safeParse = (json: string) => {
  try {
    return JSON.parse(json);
  } catch (_) {
    return undefined;
  }
};
