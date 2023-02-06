import { Label } from '.';

export default function Table({ data }: { data: { [key: string]: any }[] }) {
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
              {column}
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
                  <td key={j} className='px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:bg-gray-800'>
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
