import { Tab as ReactTab } from '@headlessui/react';
import { XIcon } from '@heroicons/react/outline';

import { align, HBox } from './Box';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Tab({
  tabs,
  children,
  defaultIndex = 0,
  selectedIndex,
  onChange = () => {},
  onTabClose = () => {},
}: {
  tabs: { title: string; action?: () => void; className?: string; width?: string; closable?: boolean }[];
  children?: JSX.Element | JSX.Element[];
  defaultIndex?: number;
  selectedIndex?: number;
  onChange?: (index: number) => void;
  onTabClose?: (i: number) => void;
}) {
  return (
    <div className='w-full'>
      <ReactTab.Group defaultIndex={defaultIndex} onChange={onChange} selectedIndex={selectedIndex}>
        <ReactTab.List className='flex justify-start h-8 border border-transparent'>
          {tabs.map((t, i) => (
            <ReactTab
              id={t.title}
              key={t.title}
              onClick={() => {
                t.action ? t.action() : (() => ({}))();
              }}
              className={({ selected }) =>
                classNames(
                  'py-1 text-xs font-medium focus-visible:outline-none rounded-sm',
                  selected
                    ? 'border-b-2 border-primary shadow text-primary dark:text-primary'
                    : 'dark:text-white hover:bg-primary hover:text-white',
                  t.className ?? '',
                  t.width ? t.width : 'w-full',
                )
              }
            >
              {t.closable && selectedIndex === i && tabs.length > 2 ? (
                <HBox alignment={align.between}>
                  <span className='ml-2'>{t.title}</span>
                  <div
                    id='close-bttn'
                    className='flex-none inline-flex justify-center p-1 mr-2 border border-transparent text-sm font-medium bg-gray-300 dark:bg-gray-600 rounded-md hover:bg-gray-400 dark:hover:bg-gray-700'
                  >
                    <XIcon
                      className='h-2 w-2 cursor-pointer'
                      aria-hidden='true'
                      onClick={() => {
                        onTabClose(i);
                      }}
                    />
                  </div>
                </HBox>
              ) : t.closable && selectedIndex !== i ? (
                <HBox alignment={align.start}>
                  <span className='ml-2'>{t.title}</span>
                </HBox>
              ) : (
                t.title
              )}
            </ReactTab>
          ))}
        </ReactTab.List>
        <ReactTab.Panels className='overflow-auto w-full h-full'>{children}</ReactTab.Panels>
      </ReactTab.Group>
    </div>
  );
}
