import { Children } from 'react';

import { RadioGroup } from '@headlessui/react';
import { CheckCircleIcon } from '@heroicons/react/solid';

export function Radio({
  selected,
  setSelected,
  children,
}: {
  selected: string;
  setSelected: (arg0: string) => void;
  children: any[] | any;
}) {
  const childArray = Children.toArray(children) as any[];
  return (
    <div className='w-full px-4 py-4'>
      <div className='mx-auto w-full max-w-md'>
        <RadioGroup value={selected} onChange={setSelected}>
          <div className='space-y-2 items-center'>
            {childArray.map((child, index) => {
              return child.type === Option ? (
                <RadioGroup.Option
                  key={child?.props?.name ?? ''}
                  value={child?.props?.value}
                  className={({ active, checked }) =>
                    `${active ? 'ring-2 ring-primary ring-opacity-60 ring-offset-2 ring-offset-sky-300' : ''}
                    ${
                      checked
                        ? 'bg-primary bg-opacity-75 text-white'
                        : 'bg-gray-200 dark:bg-gray-800 dark:text-gray-500'
                    }
                      relative flex cursor-pointer rounded-lg px-5 py-4 shadow-md focus:outline-none`
                  }
                >
                  {({ checked }) => (
                    <>
                      <div className='flex w-full items-center justify-between'>
                        <div className='flex items-center'>
                          <div className='text-sm'>{child}</div>
                        </div>
                        {checked && (
                          <div className='shrink-0'>
                            <CheckCircleIcon className='h-6 w-6' />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </RadioGroup.Option>
              ) : (
                <div key={index} className='flex justify-around pt-4'>
                  {' '}
                  {/* Let non-option children through for formatting reasons */}
                  {child}
                </div>
              );
            })}
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}

export function Option({ name, value, children }: { name: string; value: any; children: any[] | any }) {
  if (!name || !value) throw new Error('Option misconfigured'); // Get TS off my back
  return <>{children}</>;
}
