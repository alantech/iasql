import { Fragment, useRef } from 'react';

import { Dialog, Transition } from '@headlessui/react';
import { XIcon } from '@heroicons/react/outline';
import { ExclamationCircleIcon } from '@heroicons/react/solid';

import { ActionType, useAppContext } from '../providers/AppProvider';
import { useAppConfigContext } from '../providers/ConfigProvider';

export default function ErrorDialog() {
  const { dispatch, error } = useAppContext();
  const { configError } = useAppConfigContext();
  const cancelButtonRef = useRef(null);

  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog
        as='div'
        className='fixed z-10 inset-0 overflow-y-auto error-dialog'
        initialFocus={cancelButtonRef}
        open={!!error || !!configError}
        onClose={() => {
          return void 0;
        }}
      >
        <div className='flex items-end justify-center min-h-screen pt-4 px-10 pb-14 text-center sm:block sm:p-0'>
          <Transition.Child
            as={Fragment}
            enter='ease-out duration-300'
            enterFrom='opacity-0'
            enterTo='opacity-100'
            leave='ease-in duration-200'
            leaveFrom='opacity-100'
            leaveTo='opacity-0'
          >
            <Dialog.Overlay className='fixed inset-0 bg-gray-500 dark:bg-gray-800 bg-opacity-75 transition-opacity' />
          </Transition.Child>

          {/* This element is to trick the browser into centering the modal contents. */}
          <span className='hidden sm:inline-block sm:align-middle sm:h-screen' aria-hidden='true'>
            &#8203;
          </span>
          <Transition.Child
            as={Fragment}
            enter='ease-out duration-300'
            enterFrom='opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'
            enterTo='opacity-100 translate-y-0 sm:scale-100'
            leave='ease-in duration-200'
            leaveFrom='opacity-100 translate-y-0 sm:scale-100'
            leaveTo='opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'
          >
            <div className='relative inline-block align-bottom rounded-lg text-left overflow-hidden transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full'>
              <div className='bg-white dark:bg-gray-900 flex flex-row justify-between items-center pt-4 px-4'>
                <div className='flex flex-row items-center'>
                  <div className='mx-auto flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-red-700 bg-opacity-20 sm:mx-0 sm:h-7 sm:w-7'>
                    <ExclamationCircleIcon className='h-5 w-5 text-red-700' aria-hidden='true' />
                  </div>
                  <Dialog.Title
                    as='h3'
                    className='text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 ml-2'
                  >
                    Error
                  </Dialog.Title>
                </div>
                <div className='inline-flex justify-center py-1 px-1 border border-transparent text-sm font-medium bg-white dark:bg-gray-800 rounded-md text-gray-400 hover:text-gray-900'>
                  {error ? (
                    <XIcon
                      className='h-6 w-6 text-gray-400 cursor-pointer'
                      aria-hidden='true'
                      onClick={() => {
                        dispatch({ action: ActionType.ResetError });
                      }}
                    />
                  ) : (
                    <></>
                  )}
                </div>
              </div>
              <div className='bg-white dark:bg-gray-900 px-8 pt-3 pb-4 sm:px-8 sm:pb-4'>
                <div className='sm:flex-auto sm:items-start'>
                  <div className='mt-3 text-center sm:mt-0 sm:ml-0 sm:text-left'>
                    <div className='my-4 bg-white dark:bg-gray-900 sm:rounded-lg'>
                      <p className='mt-5 text-sm leading-6 text-gray-900 dark:text-gray-100'>
                        {!!error ? error : configError}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
