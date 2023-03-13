import { Tab as ReactTab } from '@headlessui/react';
import { XIcon } from '@heroicons/react/outline';

import { align, HBox } from './Box';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

function getTabContent(
  tab: { title: string; action?: () => void; className?: string; width?: string; closable?: boolean },
  idx: number,
  tabs: { title: string; action?: () => void; className?: string; width?: string; closable?: boolean }[],
  selectedIndex?: number,
  isLoading?: boolean,
  onTabClose?: (i: number) => void,
) {
  if (tab.closable && selectedIndex === idx && tabs.length > 2) {
    return (
      <HBox alignment={align.between}>
        <span className='ml-2'>{tab.title}</span>
        {isLoading ? (
          <></>
        ) : (
          <div
            id='close-bttn'
            className='flex-none inline-flex justify-center p-1 mr-2 border border-transparent text-sm font-medium bg-gray-300 dark:bg-gray-600 rounded-md hover:bg-gray-400 dark:hover:bg-gray-700'
            onClick={() => {
              onTabClose ? onTabClose(idx) : () => {};
            }}
          >
            <XIcon className='h-2 w-2 cursor-pointer' aria-hidden='true' />
          </div>
        )}
      </HBox>
    );
  }
  if ((tab.closable && selectedIndex !== idx) || isLoading) {
    return (
      <HBox alignment={align.start}>
        <span className='ml-2'>{tab.title}</span>
      </HBox>
    );
  }
  return <span>{tab.title}</span>;
}

export default function Tab({
  tabs,
  children,
  defaultIndex = 0,
  selectedIndex,
  onChange = () => {},
  onTabClose = () => {},
  isLoading,
}: {
  tabs: { title: string; action?: () => void; className?: string; width?: string; closable?: boolean }[];
  children?: JSX.Element | JSX.Element[];
  defaultIndex?: number;
  selectedIndex?: number;
  onChange?: (index: number) => void;
  onTabClose?: (i: number) => void;
  isLoading?: boolean;
}) {
  return (
    <div className='w-full'>
      <ReactTab.Group defaultIndex={defaultIndex} onChange={onChange} selectedIndex={selectedIndex}>
        <ReactTab.List className='flex justify-start h-8 border border-transparent'>
          {tabs.map((tab, idx) => (
            <ReactTab
              id={tab.title.toLowerCase().split(' ').join('-')}
              key={tab.title}
              onClick={() => {
                tab.action ? tab.action() : (() => ({}))();
              }}
              className={({ selected }) =>
                classNames(
                  'py-1 text-xs font-medium focus-visible:outline-none rounded-sm',
                  selected
                    ? 'border-b-2 border-primary shadow text-primary dark:text-primary'
                    : 'dark:text-white hover:bg-primary hover:text-white',
                  tab.className ?? '',
                  tab.width ? tab.width : 'w-full',
                )
              }
            >
              {getTabContent(tab, idx, tabs, selectedIndex, isLoading, onTabClose)}
            </ReactTab>
          ))}
        </ReactTab.List>
        <ReactTab.Panels className='overflow-auto w-full h-full'>{children}</ReactTab.Panels>
      </ReactTab.Group>
    </div>
  );
}
