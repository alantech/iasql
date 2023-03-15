import { Fragment } from 'react';

import { Dialog, Transition } from '@headlessui/react';
import { XIcon } from '@heroicons/react/outline';

import { VBox } from './Box';

export default function Modal({
  title,
  icon,
  closeable = true,
  onClose,
  isOpen,
  children,
}: {
  title: any | any[]; // TODO: Get a better type for "possibly a react component, array of them or string
  icon?: any | any[];
  closeable?: boolean;
  onClose: (e?: any) => void;
  isOpen?: boolean;
  children: any | any[];
}) {
  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog
        as='div'
        className='fixed z-10 inset-0 overflow-y-auto'
        onClose={
          closeable
            ? onClose
            : () => {
                return void 0;
              }
        }
        open={isOpen}
      >
        <div className='flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0'>
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
            <div className='relative inline-block align-bottom bg-white dark:bg-gray-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full'>
              <div className='bg-white dark:bg-gray-900 text-right flex flex-row w-full'>
                {!!icon && closeable && (
                  <div className='flex-none inline-flex justify-center mt-6 ml-6 py-1 px-1 border border-transparent'>
                    {icon}
                  </div>
                )}
                {!!icon && !closeable && (
                  <div className='flex-none inline-flex justify-center mt-3 ml-3 mb-3 mr-3 py-1 px-1 border border-transparent'>
                    {icon}
                  </div>
                )}
                <Dialog.Title
                  as='span'
                  className={`self-center text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 ${
                    !!icon ? '' : 'p-6'
                  }`}
                >
                  {title}
                </Dialog.Title>
                {closeable && (
                  <>
                    <div className='flex-grow'>&nbsp;</div>
                    <div
                      id='close-bttn'
                      className='flex-none inline-flex justify-center m-6 py-1 px-1 border border-transparent text-sm font-medium bg-white dark:bg-gray-800 rounded-md text-gray-400 hover:text-gray-900'
                    >
                      <XIcon
                        className='h-6 w-6 text-gray-400 cursor-pointer'
                        aria-hidden='true'
                        onClick={onClose}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className='bg-white dark:bg-gray-900 px-4 pt-5 pb-4 sm:p-6 sm:pb-4 sm:pt-2 pt-2'>
                <div className='text-center sm:mt-0 sm:text-left'>
                  <VBox>{children}</VBox>
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
