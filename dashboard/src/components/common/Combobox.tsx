import { Fragment, useState } from 'react';

import { Combobox as ComboboxBase, Transition } from '@headlessui/react';
import { CheckIcon, SelectorIcon } from '@heroicons/react/solid';

export default function Combobox({
  data,
  value,
  setValue,
  accessProp,
}: {
  data: any[]; // TODO: Better type here
  value: any;
  setValue: (arg0: any) => void;
  accessProp: string;
}) {
  const [selected, setSelected] = useState(value);
  const [query, setQuery] = useState('');

  const filteredData =
    query === ''
      ? data
      : data.filter(d =>
          d[accessProp].toLowerCase().replace(/\s+/g, '').includes(query.toLowerCase().replace(/\s+/g, '')),
        );

  return (
    <div className='w-full'>
      <ComboboxBase
        value={selected}
        onChange={sel => {
          setSelected(sel);
          setValue(sel);
        }}
      >
        <div className='relative mt-1'>
          <div className='relative w-full text-left bg-white dark:bg-gray-900 rounded-lg shadow-md cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-opacity-75 focus-visible:ring-white focus-visible:ring-offset-teal-300 focus-visible:ring-offset-2 sm:text-sm overflow-hidden'>
            <ComboboxBase.Input
              className='w-full border-none focus:ring-0 py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 dark:bg-gray-900 dark:text-gray-100'
              displayValue={(d: any) => d[accessProp]}
              onChange={event => setQuery(event.target.value)}
            />
            <ComboboxBase.Button className='absolute inset-y-0 right-0 flex items-center pr-2'>
              <SelectorIcon className='w-5 h-5 text-gray-400' aria-hidden='true' />
            </ComboboxBase.Button>
          </div>
          <Transition
            as={Fragment}
            leave='transition ease-in duration-100'
            leaveFrom='opacity-100'
            leaveTo='opacity-0'
            afterLeave={() => setQuery('')}
          >
            <ComboboxBase.Options className='absolute w-full py-1 mt-1 overflow-auto text-base bg-white dark:bg-gray-900 rounded-md shadow-lg max-h-60 ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm'>
              {filteredData.length === 0 && query !== '' ? (
                <div className='cursor-default select-none relative py-2 px-4 text-gray-700 dark:text-gray-300'>
                  Nothing found.
                </div>
              ) : (
                filteredData.map(d => (
                  <ComboboxBase.Option
                    key={d[accessProp]}
                    className={({ active }) =>
                      `cursor-pointer select-none relative py-2 pl-10 pr-4 ${
                        active ? 'text-primary bg-teal-600' : 'text-gray-900 dark:text-gray-100'
                      }`
                    }
                    value={d}
                  >
                    {({ selected: sel, active }) => (
                      <>
                        <span className={`block truncate ${sel ? 'font-medium' : 'font-normal'}`}>
                          {d[accessProp]}
                        </span>
                        {sel ? (
                          <span
                            className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                              active ? 'text-teal-700' : 'text-teal-600'
                            }`}
                          >
                            <CheckIcon className='w-5 h-5' aria-hidden='true' />
                          </span>
                        ) : null}
                      </>
                    )}
                  </ComboboxBase.Option>
                ))
              )}
            </ComboboxBase.Options>
          </Transition>
        </div>
      </ComboboxBase>
    </div>
  );
}
