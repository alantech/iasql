import childProcess from 'child_process'
import { readdirSync, } from 'fs'

import { v4 as uuidv4, } from 'uuid'

import * as scheduler from './scheduler'
import logger from './logger'

// We have to test the current directory if it's Typescript or Javascript. When running in `ts-node`
// mode I do not expect childProcess to actually work, but also in that situation we don't need to
// put the workers into a separate process for Kubernetes' sake since that's only during testing,
// so in that case, we can just pass-through re-export the graphile worker scheduler.
const files = readdirSync(__dirname);
const isTs = files.some(file => /.*ts$/.test(file));
const isChild = process.connected;
const shouldRpc = !isTs && !isChild;

const child = shouldRpc ? childProcess.fork(`${__dirname}/scheduler.js`) : undefined;

// Primitive RPC handler. Only the parent process can trigger an RPC call, so we can track it all
// here. Currently-active requests are turned into promises that are eventually resolved by the
// child process' return message, identified by a unique ID each message includes at the end
const messagePromises: { [key: string]: any[], } = {};

function simpleRpc(fn: string, ...args: string[]) {
  const id = uuidv4();
  const p = new Promise((resolve, reject) => {
    messagePromises[id] = [resolve, reject];
  });
  child?.send?.([fn, ...args, id]);
  return p;
}

if (!isTs) child?.on('message', (m: string[]) => {
  // By convention, the last returned value is the id. Other values are passed back for debugging
  // purposes
  logger.debug('Scheduler child process message', { m, });
  const error = m.pop();
  const id = m.pop() as string;
  messagePromises[id][!!error ? 1 : 0]?.(!!error ? new Error(error) : undefined);
});

export const init = () => shouldRpc ? simpleRpc('init') : scheduler.init();
export const start = (dbId: string, dbUser: string) => shouldRpc ? simpleRpc('start', dbId, dbUser) : scheduler.start(dbId, dbUser);
export const stop = (dbId: string) => shouldRpc ? simpleRpc('stop', dbId) : scheduler.stop(dbId);
export const stopAll = () => shouldRpc ? simpleRpc('stopAll') : scheduler.stopAll();
