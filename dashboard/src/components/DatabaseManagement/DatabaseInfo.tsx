import { useAppContext } from '@/components/providers/AppProvider';

import { HBox, DoubleBox, Spinner } from '../common';
import { DatabaseStatus } from './DatabaseStatus';

export function DatabaseInfo() {
  const { selectedDb } = useAppContext();

  return !selectedDb ? (
    <Spinner />
  ) : (
    <HBox width='w-full' customStyles='grid grid-cols-6'>
      <DoubleBox
        firstChildren='Postgres DB'
        firstStyle='text-xs'
        secondChildren={
          <span title={selectedDb.pgName} className='truncate'>
            {selectedDb.pgName}
          </span>
        }
        secondStyle='text-xs text-gray-500 dark:text-gray-500'
      />
      <DoubleBox
        firstChildren='User'
        firstStyle='text-xs'
        secondChildren={<span className='truncate'>{selectedDb.pgUser}</span>}
        secondStyle='text-xs text-gray-500 dark:text-gray-500'
      />
      <DoubleBox
        firstChildren='Record count'
        firstStyle='text-xs'
        secondChildren={<span className='truncate'>{selectedDb.recordCount}</span>}
        secondStyle='text-xs text-gray-500 dark:text-gray-500'
      />
      <DoubleBox
        firstChildren='Default Region'
        firstStyle='text-xs'
        secondChildren={<span className='truncate'>{selectedDb.region}</span>}
        secondStyle='text-xs text-gray-500 dark:text-gray-500'
      />
      <DoubleBox
        firstChildren='Version'
        firstStyle='text-xs'
        secondChildren={<span className='truncate'>{selectedDb.version}</span>}
        secondStyle='text-xs text-gray-500 dark:text-gray-500'
      />
      <DoubleBox
        firstChildren='Status'
        firstStyle='text-xs'
        secondChildren={<DatabaseStatus db={selectedDb} />}
      />
    </HBox>
  );
}
