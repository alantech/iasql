import fetch from 'node-fetch';
import logger from '../services/logger';
import { readdirSync } from "fs";
import * as scheduler from './scheduler';

const schedulerAddress = 'http://localhost:14527';

// call the scheduler functions locally when on tests
const files = readdirSync(__dirname);
const isTs = files.some(file => /.*ts$/.test(file));
const shouldRpc = !isTs;

async function fetchOrRaise(url: string) {
  const response = await fetch(url);
  if (response.ok) {
    return response;
  }
  const error = await response.text();
  logger.error(`Error received from Scheduler: ${error}`);
  throw new Error(error);
}


export const init = () => (shouldRpc ? fetchOrRaise(`${schedulerAddress}/init/`) : scheduler.init());
export const start = (dbId: string, dbUser: string) => (shouldRpc ? fetchOrRaise(`${schedulerAddress}/start/${dbId}/${dbUser}/`) : scheduler.start(dbId, dbUser));
export const stop = (dbId: string) => (shouldRpc ? fetchOrRaise(`${schedulerAddress}/stop/${dbId}/`) : scheduler.stop(dbId));
export const stopAll = () => (shouldRpc ? fetchOrRaise(`${schedulerAddress}/stopAll/`) : scheduler.stopAll());
