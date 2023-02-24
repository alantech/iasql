import * as semver from 'semver';

import { useAppContext } from '@/components/providers/AppProvider';
import { CheckCircleIcon, ClockIcon, ExclamationCircleIcon } from '@heroicons/react/outline';

export function DatabaseStatus({ db }: { db: any }) {
  const { latestVersion, oldestVersion } = useAppContext();
  const isUnsupported = db.isUnsupported;
  let statusElement;
  if (!db.isReady && db.upgrading) {
    statusElement = (
      <div className='flex items-center'>
        <span className='shrink-0'>
          <ClockIcon className='h-5 w-5 text-primary' aria-hidden='true' />
        </span>
        <p className='text-sm text-primary ml-1'>Upgrading</p>
      </div>
    );
  } else if (!db.isReady) {
    statusElement = (
      <div className='flex items-center'>
        <span className='shrink-0'>
          <ExclamationCircleIcon className='w-5 h-5 mr-1 text-tertiary' aria-hidden='true' />
        </span>
        <p className='text-sm text-tertiary'>Invalid creds</p>
      </div>
    );
  } else if (db.upgrading) {
    statusElement = (
      <div className='flex items-center'>
        <span className='shrink-0'>
          <ClockIcon className='h-5 w-5 text-primary' aria-hidden='true' />
        </span>
        <p className='text-sm text-primary ml-1'>Upgrading</p>
      </div>
    );
  } else if (
    !!latestVersion &&
    !!oldestVersion &&
    latestVersion !== db.version &&
    semver.valid(db.version) &&
    semver.gte(db.version, oldestVersion)
  ) {
    statusElement = (
      <div className='flex items-center'>
        <span className='shrink-0'>
          <ExclamationCircleIcon className='w-5 h-5 mr-1 text-warn' aria-hidden='true' />
        </span>
        <p className='text-sm text-warn'>Outdated</p>
      </div>
    );
  } else if (!!latestVersion && latestVersion !== db.version && isUnsupported) {
    statusElement = (
      <div className='flex items-center'>
        <span className='shrink-0'>
          <ExclamationCircleIcon className='w-5 h-5 mr-1 text-tertiary' aria-hidden='true' />
        </span>
        <p className='text-sm text-tertiary'>Unsupported</p>
      </div>
    );
  } else {
    statusElement = (
      <div className='flex items-center'>
        <span className='shrink-0'>
          <CheckCircleIcon className='w-5 h-5 mr-1 text-secondary' aria-hidden='true' />
        </span>
        <p className='text-sm text-secondary'>Ready</p>
      </div>
    );
  }
  return statusElement;
}
