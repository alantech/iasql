import { HBox } from '../common';
import { DatabaseActions } from './DatabaseActions';
import { DatabaseInfo } from './DatabaseInfo';
import { DatabaseSelection } from './DatabaseSelection';

export function DatabaseManagement() {
  return (
    <HBox customStyles='grid grid-cols-3 sm:text-md sm:grid-cols-10 sm:grid-rows-2 xl:grid-rows-1'>
      <HBox customStyles='col-span-full sm:col-span-2 xl:col-span-2'>
        <DatabaseSelection />
      </HBox>
      <HBox customStyles='row-start-3 col-span-3 auto-rows-max sm:row-start-2 sm:col-span-10 sm:pt-3 xl:px-1 xl:col-span-6 xl:row-auto'>
        <DatabaseInfo />
      </HBox>
      <HBox customStyles='row-start-2 col-span-auto sm:row-start-auto sm:col-span-4 sm:col-start-7 xl:col-span-2'>
        <DatabaseActions />
      </HBox>
    </HBox>
  );
}
