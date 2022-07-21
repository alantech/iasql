import { FunctionConfiguration, Lambda, paginateListFunctions } from '@aws-sdk/client-lambda';

import { AWS, crudBuilder2, paginateBuilder, } from '../../../services/aws_macros'

export const createFunction = crudBuilder2<Lambda, 'createFunction'>(
  'createFunction',
  (input) => (input),
);

export const getFunction = crudBuilder2<Lambda, 'getFunction'>(
  'getFunction',
  (FunctionName) => ({ FunctionName }),
);

export const listFunctions = paginateBuilder<Lambda>(paginateListFunctions, 'Functions');

export const getFunctions = async (client: Lambda) => {
  const functions: FunctionConfiguration[] = await listFunctions(client);
  const out = [];
  for (const fn of functions) {
    const fnRes = await getFunction(client, fn.FunctionName);
    if (fnRes) out.push(fnRes);
  }
  return out;
}

export { AWS }
