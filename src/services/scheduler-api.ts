import { readdirSync } from 'fs';
import fetch from 'node-fetch';

import { IasqlDatabase } from '../entity';
import logger from '../services/logger';
import MetadataRepo from './repositories/metadata';
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
export const start = async (dbId: string) => {
  if (shouldRpc) return fetchOrRaise(`${schedulerAddress}/start/${dbId}/`);
  const db = (await MetadataRepo.getDbById(dbId)) as IasqlDatabase;
  return scheduler.start(db);
};
export const stop = async (dbId: string) => {
  if (shouldRpc) return fetchOrRaise(`${schedulerAddress}/stop/${dbId}/`);
  const db = (await MetadataRepo.getDbById(dbId)) as IasqlDatabase;
  return scheduler.stop(db);
};
export const stopAll = () => (shouldRpc ? fetchOrRaise(`${schedulerAddress}/stopAll/`) : scheduler.stopAll());
