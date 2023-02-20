import { Tab as ReactTab } from '@headlessui/react';

import { useAppContext } from '../AppProvider';
import { align, Tab, VBox } from '../common';
import Modules from './Modules';
import Schema from './Schema';

export default function QuerySidebar() {
  const { functions, allModules, installedModules } = useAppContext();
  return (
    <div className='h-50vh w-1/4 font-normal text-xs mr-2 overflow-auto' id='query-sidebar'>
      <Tab tabs={[{ title: 'Schema' }, { title: 'Modules' }]} defaultIndex={1}>
        <VBox alignment={align.start} customStyles='h-sidebar bg-gray-100/20 dark:bg-gray-800 w-full overflow-auto'>
          <ReactTab.Panel className='w-full p-2 font-mono bg-gray-100/20 dark:bg-gray-800'>
            <div className='overflow-auto'>
              <Schema moduleData={installedModules} functionData={functions} />
            </div>
          </ReactTab.Panel>
          <ReactTab.Panel className='dark:bg-gray-800'>
            <Modules modulesInstalledData={installedModules} allModules={allModules} />
          </ReactTab.Panel>
        </VBox>
      </Tab>
    </div>
  );
}
