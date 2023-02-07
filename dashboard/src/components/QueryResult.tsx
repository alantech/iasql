import { useAppContext } from '../AppProvider';
import EmptyState from './EmptyState';
import { Label, Spinner, Table, VBox } from './common';

export default function QueryResult() {
  const { queryRes, isRunningSql } = useAppContext();

  // TODO: show all statements with its respective query and not just the last one
  return isRunningSql ? (
    <Spinner />
  ) : queryRes === undefined ? (
    <EmptyState>
      <p>No query results</p>
      <p className='font-normal'>
        Enter a query and click <strong>Run query</strong>
      </p>
    </EmptyState>
  ) : (
    <VBox id='query-builder-result' customStyles='overflow-x-auto'>
      {!!queryRes && typeof queryRes === 'string' && <Label>{queryRes}</Label>}
      {!!queryRes && queryRes instanceof Array && !queryRes[0]?.result && (
        <VBox>{<Table data={queryRes} />}</VBox>
      )}
      {!!queryRes &&
        queryRes instanceof Array &&
        queryRes[0]?.result instanceof Array &&
        queryRes.filter(r => (r.result ?? []).length > 0).length > 0 && (
          <Table
            data={queryRes
              .filter(r => (r.result ?? []).length > 0)
              .map(r => r.result ?? [])
              .at(-1)}
          />
        )}
      {!!queryRes &&
        queryRes instanceof Array &&
        (queryRes[0]?.result ?? []) instanceof Array &&
        queryRes.filter(r => (r.result ?? []).length > 0).length === 0 && <Label>Empty response</Label>}
    </VBox>
  );
}
