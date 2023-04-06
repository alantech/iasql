import { IconContext } from 'react-icons';
import {
  MdAccessTime,
  MdDataArray,
  MdDataObject,
  MdDateRange,
  MdNumbers,
  MdOutlineApps,
  MdOutlineToggleOff,
  MdTextFields,
} from 'react-icons/md';

import { align, HBox, Label } from '.';

function getIconForDataType(dataType: number | undefined) {
  // https://github.com/brianc/node-pg-types/blob/master/lib/builtins.js#L12-L73
  switch (dataType) {
    case 16: // boolean
      return <MdOutlineToggleOff />;
    case 20:
    case 21:
    case 23:
    case 1700: // integer
      return <MdNumbers />;
    case 2950: // uuid
    case 25: // text
    case 1043: // varchar
      return <MdTextFields />;
    case 3802: // jsonb
    case 114: // json
      return <MdDataObject />;
    case 1082: // date
    case 1083: // time
      return <MdDateRange />;
    case 1114:
    case 1184: // timestamp
      return <MdAccessTime />;
    case 1009: // array
      return <MdDataArray />;
    default:
      return <MdOutlineApps />;
  }
}

export default function Table({
  data,
  dataTypes,
}: {
  data: { [key: string]: any }[];
  dataTypes?: { [columnName: string]: number };
}) {
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  if (data.length === 0) return <Label>No results returned</Label>;

  return (
    <table className='mb-2 min-w-full divide-y divide-gray-200 dark:divide-gray-800 shadow overflow-x-auto border-b border-gray-200 dark:border-gray-800 sm:rounded-lg'>
      <thead className='bg-gray-100 dark:bg-gray-900'>
        <tr>
          {columns.map(column => (
            <th
              className='group px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
              scope='col'
              key={column}
            >
              <HBox alignment={align.start}>
                <IconContext.Provider value={{ className: 'inline-block', size: '1.5em' }}>
                  {getIconForDataType(dataTypes?.[column])}
                </IconContext.Provider>
                <div className={'inline-block pl-2'}>{column}</div>
              </HBox>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className='bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-800'>
        {data.map((row, i) => {
          return (
            <tr key={i}>
              {Object.values(row).map((cell, j) => {
                return (
                  <td
                    key={j}
                    className={`px-6 py-4 text-sm text-gray-500 dark:bg-gray-800 ${
                      typeof cell === 'string' ? 'whitespace-pre-line' : 'whitespace-nowrap'
                    }`}
                  >
                    <>
                      {typeof cell === 'object' && JSON.stringify(cell)}
                      {typeof cell === 'boolean' && <input type='checkbox' disabled={true} checked={cell} />}
                      {typeof cell !== 'object' && typeof cell !== 'boolean' && cell}
                    </>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
