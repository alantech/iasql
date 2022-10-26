export const safeParse = (json: string) => {
  try {
    return JSON.parse(json);
  } catch (_) {
    return undefined;
  }
};
