import {
  CreateFunctionCommandInput,
  FunctionConfiguration,
  Lambda,
  paginateListFunctions,
  waitUntilFunctionActiveV2,
  waitUntilFunctionExists,
  waitUntilFunctionUpdatedV2,
} from '@aws-sdk/client-lambda';

import { AWS, crudBuilder2, paginateBuilder } from '../../../services/aws_macros';

const innerCreateFunction = crudBuilder2<Lambda, 'createFunction'>('createFunction', input => input);

export const createFunction = async (client: Lambda, input: CreateFunctionCommandInput) => {
  let counter = 0;
  do {
    try {
      return await innerCreateFunction(client, input);
    } catch (e: any) {
      if (e.message !== 'The role defined for the function cannot be assumed by Lambda.') break;
    }
    counter++;
    await new Promise(r => setTimeout(r, 5000));
  } while (counter <= 10);
};

export const getFunction = crudBuilder2<Lambda, 'getFunction'>('getFunction', FunctionName => ({
  FunctionName,
}));

export const listFunctions = paginateBuilder<Lambda>(paginateListFunctions, 'Functions');

export const getFunctions = async (client: Lambda) => {
  const functions: FunctionConfiguration[] = await listFunctions(client);
  const out = [];
  for (const fn of functions) {
    const fnRes = await getFunction(client, fn.FunctionName);
    if (fnRes) out.push(fnRes);
  }
  return out;
};

export const deleteFunction = crudBuilder2<Lambda, 'deleteFunction'>('deleteFunction', FunctionName => ({
  FunctionName,
}));

export const addFunctionTags = crudBuilder2<Lambda, 'tagResource'>('tagResource', (Resource, Tags) => ({
  Resource,
  Tags,
}));

export const updateFunctionConfiguration = crudBuilder2<Lambda, 'updateFunctionConfiguration'>(
  'updateFunctionConfiguration',
  input => input
);

export const updateFunctionCode = crudBuilder2<Lambda, 'updateFunctionCode'>(
  'updateFunctionCode',
  input => input
);

export const listFunctionTags = crudBuilder2<Lambda, 'listTags'>('listTags', Resource => ({ Resource }));

export const removeFunctionTags = crudBuilder2<Lambda, 'untagResource'>(
  'untagResource',
  (Resource, TagKeys) => ({
    Resource,
    TagKeys,
  })
);

export const waitUntilFunctionActive = (client: Lambda, FunctionName: string) => {
  return waitUntilFunctionActiveV2(
    {
      client,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    },
    { FunctionName }
  );
};

export const waitUntilFunctionUpdated = (client: Lambda, FunctionName: string) => {
  return waitUntilFunctionUpdatedV2(
    {
      client,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    },
    { FunctionName }
  );
};

export { AWS };
