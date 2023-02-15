import { Tab as ReactTab } from '@headlessui/react';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Tab({
  tabs,
  children,
  defaultIndex = 0,
  selectedIndex,
  onChange = () => {},
}: {
  tabs: { title: string; action?: () => void; className?: string; width?: string }[];
  children?: JSX.Element | JSX.Element[];
  defaultIndex?: number;
  selectedIndex?: number;
  onChange?: (index: number) => void;
}) {
  return (
    <div className='w-full'>
      <ReactTab.Group defaultIndex={defaultIndex} onChange={onChange} selectedIndex={selectedIndex}>
        <ReactTab.List className='flex justify-start h-8 bg-blue-900/20'>
          {tabs.map(t => (
            <ReactTab
              key={t.title}
              onClick={() => {
                t.action ? t.action() : (() => ({}))();
              }}
              className={({ selected }) =>
                classNames(
                  'py-1 text-xs font-medium dark:text-white',
                  selected ? 'bg-primary shadow' : 'dark:text-white hover:bg-primary',
                  t.className ?? '',
                  t.width ? t.width : 'w-full',
                )
              }
            >
              {t.title}
            </ReactTab>
          ))}
        </ReactTab.List>
        <ReactTab.Panels className='overflow-auto w-full h-full'>{children}</ReactTab.Panels>
      </ReactTab.Group>
    </div>
  );
}
