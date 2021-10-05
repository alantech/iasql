export class DepError {
  message: string
  metadata?: any

  constructor(message: string, metadata?: any) {
    this.message = message;
    this.metadata = metadata;
  }
}

export async function lazyLoader(promiseGenerators: (() => Promise<any>)[]) {
  console.log('Running lazyLoader...');
  // Set up the tracking variables for the promise execution
  let generatorsToRun = [...promiseGenerators]; // Shallow clone to not mutate the input
  let generatorsRun = 0;
  let generatorsSuccess = 0;
  // Running at least one time, run every promise in parallel, and mark the failures to attempt
  // a re-run. The loop continues until either all promises resolve successfully, or there are
  // two runs in a row that fail identically, meaning no forward progress is possible and there
  // was an unrecoverable failure, which causes this function to also fail.
  do {
    console.log('Starting a loop...');
    generatorsSuccess = 0;
    const results = await Promise.allSettled(generatorsToRun.map(g => g()));
    generatorsRun = results.length;
    const generatorsToRerun = [];
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'fulfilled') {
        generatorsSuccess++;
        continue;
      }
      generatorsToRerun.push(generatorsToRun[i]);
    }
    if (generatorsToRun.length === generatorsToRerun.length) {
      console.log(results);
      break;
    }
    generatorsToRun = generatorsToRerun;
  } while (generatorsToRun.length > 0);
  console.log('lazyLoader done!');
  // Handle the success and error paths
  if (generatorsToRun.length === 0) {
    return true;
  } else {
    throw new DepError('Forward progress halted. Some promises never resolved', {
      generatorsToRun,
    });
  }
}