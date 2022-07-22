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

export const deleteFunction = crudBuilder2<Lambda, 'deleteFunction'>(
  'deleteFunction',
  (FunctionName) => ({ FunctionName }),
);

export const addFunctionTags = crudBuilder2<Lambda, 'tagResource'>(
  'tagResource',
  (Resource, Tags) => ({ Resource, Tags }),
);

export const updateFunctionConfiguration = crudBuilder2<Lambda, 'updateFunctionConfiguration'>(
  'updateFunctionConfiguration',
  (input) => (input),
);

export const updateFunctionCode = crudBuilder2<Lambda, 'updateFunctionCode'>(
  'updateFunctionCode',
  (input) => (input),
);

export const listFunctionTags = crudBuilder2<Lambda, 'listTags'>(
  'listTags',
  (Resource) => ({ Resource }),
);

export const removeFunctionTags = crudBuilder2<Lambda, 'untagResource'>(
  'untagResource',
  (Resource, TagKeys) => ({ Resource, TagKeys }),
);

export { AWS }
