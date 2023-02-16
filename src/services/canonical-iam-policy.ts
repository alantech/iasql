import _ from 'lodash';

type Principal =
  | '*'
  | { AWS?: string | string[]; Service?: string | string[]; Federated?: string | string[] };

type Condition = {
  [operator: string]: { [key: string]: string | boolean | number | (string | boolean | number)[] };
};

type Statement = {
  Action?: string | string[]; // case insensitive
  NotAction?: string | string[]; // case insensitive
  Principal?: Principal;
  NotPrincipal?: Principal; // case sensitive
  Resource?: string | string[]; // case sensitive
  NotResource?: string | string[]; // case sensitive
  Condition?: Condition; // key is case-insensitive
  Effect: 'Allow' | 'Deny';
  Sid?: string;
};
export type Policy = {
  Id?: string; // case sensitive
  Statement: Statement | Statement[];
  Version: string;
};

function normalizeAction(action: string | string[]) {
  if (!Array.isArray(action)) action = [action];
  return action.map(a => a.toLowerCase()).sort();
}

function normalizePrincipal(principal: Principal) {
  if (principal === '*')
    principal = {
      AWS: ['*'],
    };
  if (principal.AWS && !Array.isArray(principal.AWS)) principal.AWS = [principal.AWS];
  if (principal.Service && !Array.isArray(principal.Service)) principal.Service = [principal.Service];
  if (principal.Federated && !Array.isArray(principal.Federated)) principal.Federated = [principal.Federated];
  return principal;
}

function normalizeResource(resource: string | string[]) {
  if (!Array.isArray(resource)) resource = [resource];
  return resource.sort();
}

function normalizeCondition(condition: Condition) {
  const canonicalCondition: Condition = {};
  for (const [operator, keyVal] of Object.entries(condition)) {
    canonicalCondition[operator] = {};
    for (let [key, value] of Object.entries(keyVal)) {
      if (!Array.isArray(value)) value = [value];
      canonicalCondition[operator][key.toLowerCase()] = _.uniq(_.map(value, _.toString));
    }
  }
  return canonicalCondition;
}

function normalizeStatement(statement: Statement) {
  if (statement.Action) statement.Action = normalizeAction(statement.Action);
  if (statement.NotAction) statement.NotAction = normalizeAction(statement.NotAction);

  if (statement.Principal) statement.Principal = normalizePrincipal(statement.Principal);
  if (statement.NotPrincipal) statement.NotPrincipal = normalizePrincipal(statement.NotPrincipal);

  if (statement.Resource) statement.Resource = normalizeResource(statement.Resource);
  if (statement.NotResource) statement.NotResource = normalizeResource(statement.NotResource);

  if (statement.Condition) statement.Condition = normalizeCondition(statement.Condition);

  return statement;
}

export function normalizePolicy(policy: Policy) {
  const clone: Policy = JSON.parse(JSON.stringify(policy)); // deep clone

  if (!Array.isArray(clone.Statement)) clone.Statement = [clone.Statement];
  clone.Statement = clone.Statement.map(s => normalizeStatement(s));
  return clone;
}
