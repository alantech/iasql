import { TableIcon } from '@heroicons/react/outline';
import { QuestionMarkCircleIcon } from '@heroicons/react/solid';

import { Accordion, align, HBox, VBox } from '../common';
import { ActionType, useAppContext } from '../providers/AppProvider';

export default function Schema({
  moduleData,
  functionData,
}: {
  moduleData: {
    [moduleName: string]: { [tableName: string]: { [columnName: string]: { dataType: string, isMandatory: boolean } } & { recordCount: number } };
  };
  functionData: {
    [moduleName: string]: {
      [functionName: string]: string;
    };
  };
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
  const helpIcon = <QuestionMarkCircleIcon className='w-4 h-4 m-2' aria-hidden='true' />;
  const goToDocs = (moduleName: string) => {
    let modulePath;
    if (typeof moduleName === 'string' && moduleName.startsWith('aws')) modulePath = 'aws';
    else if (moduleName.startsWith('iasql')) modulePath = 'builtin';
    window.open(
      `https://iasql.com/docs/modules/${modulePath ? `${modulePath}/${moduleName}/` : ''}`,
      '_blank',
      'noreferrer',
    );
  };

  return (
    <VBox customClasses='w-full bg-transparent dark:bg-gray-800' id='schema-tab'>
      {/* TODO: make this a component */}
      <Accordion id='modules' title='Modules' titleCustomClasses='font-bold' defaultOpen={true}>
        {Object.keys(moduleData ?? {}).map((moduleName: string) => (
          <Accordion
            key={moduleName}
            id={moduleName}
            title={moduleName.split('@')[0]}
            titleCustomClasses='font-bold'
            defaultOpen={true}
            action={{ icon: helpIcon, handler: goToDocs }}
          >
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
                  .map(([col, meta]) => (
                    <HBox key={col}
                          customStyles={(meta as any).isMandatory && !tableName.includes('iasql_') ? 'pl-8 grid grid-cols-2 gap-2 font-bold' : 'pl-8 grid grid-cols-2 gap-2'}>
                      <HBox alignment={align.start}>
                        <p className='text-ellipsis overflow-hidden' title={col}>
                          {col}
                        </p>
                      </HBox>
                      <HBox alignment={align.start}>
                        <p className='text-ellipsis overflow-hidden'>{(meta as {dataType:string, isMandatory: boolean}).dataType}</p>
                      </HBox>
                    </HBox>
                  ))}
              </Accordion>
            ))}
          </Accordion>
        ))}
      </Accordion>
      <Accordion id='functions' title='Functions' titleCustomClasses='font-bold' defaultOpen={true}>
        {Object.keys(functionData ?? {}).map((moduleName: string) => (
          <Accordion
            key={moduleName}
            id={`fn-${moduleName}`}
            title={moduleName.split('@')[0]}
            titleCustomClasses='font-bold'
            defaultOpen={true}
          >
            {Object.entries(functionData[moduleName]).map(([functionName, functionSignature], i) => (
              <Accordion key={functionName} id={functionName} title={functionName} defaultOpen={false}>
                <HBox key={i} alignment={align.start} customStyles='pl-8'>
                  {functionSignature}
                </HBox>
              </Accordion>
            ))}
          </Accordion>
        ))}
      </Accordion>
    </VBox>
  );
}
