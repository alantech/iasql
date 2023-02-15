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
  style = 'solid',
}: {
  tabs: { title: string; action?: () => void; className?: string; width?: string }[];
  children?: JSX.Element | JSX.Element[];
  defaultIndex?: number;
  selectedIndex?: number;
  onChange?: (index: number) => void;
  style?: 'solid' | 'outline';
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
              {t.title}
            </ReactTab>
          ))}
        </ReactTab.List>
        <ReactTab.Panels className='overflow-auto w-full h-full'>{children}</ReactTab.Panels>
      </ReactTab.Group>
    </div>
  );
}
