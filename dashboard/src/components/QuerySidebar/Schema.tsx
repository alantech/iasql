import { TableIcon } from '@heroicons/react/outline';

import { Accordion, align, HBox, VBox } from '../common';
import { ActionType, useAppContext } from '../providers/AppProvider';

export default function Schema({
  moduleData,
  functionData,
}: {
  moduleData: {
    [moduleName: string]: { [tableName: string]: { [columnName: string]: string } & { recordCount: number } };
  };
  functionData: any[];
}) {
  const { dispatch } = useAppContext();
  const selectTableIcon = <TableIcon className='w-4 h-4 m-2' aria-hidden='true' />;
  const selectTable = (tableName: string) => {
    dispatch({
      action: ActionType.SelectTable,
      data: {
        tableName,
      },
    });
  };

  return (
    <VBox customClasses='w-full bg-transparent dark:bg-gray-800' id='schema-tab'>
      {/* TODO: make this a component */}
      <Accordion id='modules' title={<b>Modules</b>} defaultOpen={true}>
        {Object.keys(moduleData ?? {}).map((moduleName: string) => (
          <Accordion key={moduleName} id={moduleName} title={<b>{moduleName}</b>} defaultOpen={true}>
            {Object.keys(moduleData[moduleName]).map((tableName: string) => (
              <Accordion
                key={tableName}
                id={tableName}
                title={tableName}
                defaultOpen={false}
                action={
                  moduleData[moduleName][tableName]?.recordCount > 0
                    ? { icon: selectTableIcon, handler: selectTable }
                    : undefined
                }
              >
                {Object.entries(moduleData[moduleName][tableName])
                  .filter(([col, _]) => col !== 'recordCount')
                  .map(([col, typ]) => (
                    <HBox key={col} customStyles='pl-8 grid grid-cols-2 gap-2'>
                      <HBox alignment={align.start}>{col}</HBox>
                      <HBox alignment={align.start}>{typ}</HBox>
                    </HBox>
                  ))}
              </Accordion>
            ))}
          </Accordion>
        ))}
      </Accordion>
      <Accordion id='functions' title={<b>Functions</b>} defaultOpen={true}>
        {functionData
          ?.filter((h: any) => !!h?.signature)
          ?.map((h: any) => (
            <div className='ml-8' key={h.signature}>
              {h.signature}
            </div>
          ))}
      </Accordion>
    </VBox>
  );
}
