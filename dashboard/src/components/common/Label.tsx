import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/outline';

export default function Label({
  htmlFor,
  mode,
  children,
}: {
  htmlFor?: string;
  mode?: 'default' | 'warn' | 'info';
  children: any[] | any;
}) {
  if (!mode || mode === 'default') {
    return (
      <label htmlFor={htmlFor} className='text-sm text-gray-500 my-3'>
        {children}
      </label>
    );
  } else if (mode === 'warn') {
    return (
      <div className='my-3 p-3 flex flex-row items-center bg-warn bg-opacity-50 rounded'>
        <span className='shrink-0'>
          <ExclamationCircleIcon className='h-7 w-7 mx-2 text-warn' aria-hidden='true' />
        </span>
        <label htmlFor={htmlFor} className='ml-2 max-w-2xl text-sm text-gray-900 dark:text-gray-100'>
          {children}
        </label>
      </div>
    );
  } else {
    // Info
    return (
      <div className='flex items-center my-3'>
        <span className='shrink-0'>
          <CheckCircleIcon className='h-7 w-7 mx-2 text-secondary' aria-hidden='true' />
        </span>
        <label
          htmlFor={htmlFor}
          className='text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 ml-2'
        >
          {children}
        </label>
      </div>
    );
  }
}
