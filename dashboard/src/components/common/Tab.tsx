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
  style = 'solid',
  onTabClose = () => {},
}: {
  tabs: { title: string; action?: () => void; className?: string; width?: string; closable?: boolean }[];
  children?: JSX.Element | JSX.Element[];
  defaultIndex?: number;
  selectedIndex?: number;
  onChange?: (index: number) => void;
  style?: 'solid' | 'outline';
  onTabClose?: (i: number) => void;
}) {
  return (
    <div className='w-full'>
      <ReactTab.Group defaultIndex={defaultIndex} onChange={onChange} selectedIndex={selectedIndex}>
        <ReactTab.List className='flex justify-start h-8 bg-blue-900/20'>
          {tabs.map((t, i) => (
            <ReactTab
              key={t.title}
              onClick={() => {
                t.action ? t.action() : (() => ({}))();
              }}
              className={({ selected }) =>
                classNames(
                  'py-1 text-xs font-medium dark:text-white focus-visible:outline-none',
                  style === 'solid' && selected
                    ? 'bg-primary shadow'
                    : style === 'solid' && !selected
                    ? 'dark:text-white hover:bg-primary'
                    : style === 'outline' && selected
                    ? 'border border-primary shadow dark:text-primary text-primary'
                    : 'dark:text-white hover:border hover:border-primary',
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
                    className='flex-none inline-flex justify-center p-1 mr-2 border border-transparent text-sm font-medium bg-white dark:bg-gray-600 rounded-md text-gray-400 hover:text-primary dark:hover:bg-gray-700'
                  >
                    <XIcon
                      className='h-2 w-2 text-gray-400 cursor-pointer'
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
