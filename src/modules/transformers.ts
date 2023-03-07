// transformer to convert string to decimal
// @see https://github.com/typeorm/typeorm/issues/873#issuecomment-424643086
export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string): number {
    return parseFloat(data);
  }
}
