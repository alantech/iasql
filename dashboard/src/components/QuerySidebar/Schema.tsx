import {
  MdDataArray,
  MdDataObject,
  MdDateRange,
  MdNumbers,
  MdOutlineApps,
  MdOutlineToggleOff,
  MdTextFields,
  MdQuestionMark,
} from 'react-icons/md';
import { TbNetwork } from 'react-icons/tb';

import { TableIcon } from '@heroicons/react/outline';
import { QuestionMarkCircleIcon } from '@heroicons/react/solid';

import { Accordion, align, HBox, VBox } from '../common';
import { ActionType, useAppContext } from '../providers/AppProvider';

function getIconForDataType(dataType: string) {
  switch (dataType) {
    case 'boolean':
      return <MdOutlineToggleOff />;
    case 'smallint':
    case 'double precision':
    case 'integer':
      return <MdNumbers />;
    case 'character varying':
    case 'text':
      return <MdTextFields />;
    case 'json':
    case 'jsonb':
      return <MdDataObject />;
    case 'timestamp with time zone':
    case 'timestamp without time zone':
      return <MdDateRange />;
    case 'cidr':
      return <TbNetwork />;
    case 'ARRAY':
      return <MdDataArray />;
    case 'USER-DEFINED':
      return <MdOutlineApps />;
    default:
      return <MdQuestionMark />;
  }
}

export default function Schema({
  moduleData,
  functionData,
}: {
  moduleData: {
    [moduleName: string]: {
      [tableName: string]: { [columnName: string]: { dataType: string; isMandatory: boolean } } & {
        recordCount: number;
      };
    };
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
  type columnMetadata = { dataType: string; isMandatory: boolean };

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
                    <HBox
                      key={col}
                      customStyles={
                        (meta as columnMetadata).isMandatory && !tableName.includes('iasql_')
                          ? 'pl-8 grid grid-cols-12 gap-1 font-bold'
                          : 'pl-8 grid grid-cols-12 gap-1'
                      }
                    >
                      <HBox customStyles={'col-span-1'}>
                        {getIconForDataType((meta as columnMetadata).dataType)}
                      </HBox>
                      <HBox alignment={align.start} customStyles={'col-span-5'}>
                        <p className='text-ellipsis overflow-hidden' title={col}>
                          {col}
                        </p>
                      </HBox>
                      <HBox alignment={align.start} customStyles={'col-span-6'}>
                        <p
                          className='text-ellipsis overflow-hidden'
                          title={(meta as columnMetadata).dataType}
                        >
                          {(meta as columnMetadata).dataType}
                        </p>
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
