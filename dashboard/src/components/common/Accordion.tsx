import { Disclosure, Transition } from '@headlessui/react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/outline';

import { HBox, align } from './';

export default function Accordion({
  title,
  defaultOpen,
  children,
  id,
}: {
  title: any | any[];
  defaultOpen?: boolean;
  children: any | any[];
  id: string;
}) {
  return (
    <Disclosure as='div' defaultOpen={defaultOpen}>
      {({ open }) => (
        <div className='bg-transparent dark:bg-gray-800 pl-2'>
          <Disclosure.Button className='w-full'>
            <div className='border-b-4 pl-1 border-transparent dark:border-gray-800'>
              <HBox alignment={align.end} customStyles='flex-row-reverse'>
                <span id={`accordion-${id}`}>{title}</span>
                {open ? (
                  <ChevronDownIcon className='w-3 h-3 m-2' aria-hidden='true' />
                ) : (
                  <ChevronRightIcon className='w-3 h-3 m-2' aria-hidden='true' />
                )}
              </HBox>
            </div>
          </Disclosure.Button>
          <div>
            <Transition
              enter='transition duration-100 ease-out overflow-y-hidden'
              enterFrom='transform h-0 opacity-0'
              enterTo='transform h-auto opacity-100'
              leave='transition duration-75 ease-out'
              leaveFrom='transform h-auto opacity-100'
              leaveTo='transform h-0 opacity-0'
            >
              {open && <Disclosure.Panel static>{children}</Disclosure.Panel>}
            </Transition>
          </div>
        </div>
      )}
    </Disclosure>
  );
}
