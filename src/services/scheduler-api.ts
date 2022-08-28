import fetch from 'node-fetch';
import logger from '../services/logger';

const schedulerAddress = 'http://localhost:14527';

async function fetchOrRaise(url: string) {
  const response = await fetch(url);
  if (response.ok) {
    return
  }
  const error = await response.text();
  logger.error(`Error received from Scheduler: ${error}`);
  throw new Error(error);
}

export const init = () => fetchOrRaise(`${schedulerAddress}/init/`);
export const start = (dbId: string, dbUser: string) => fetchOrRaise(`${schedulerAddress}/start/${dbId}/${dbUser}/`);
export const stop = (dbId: string) => fetchOrRaise(`${schedulerAddress}/stop/${dbId}/`);
export const stopAll = () => fetchOrRaise(`${schedulerAddress}/stopAll/`);
