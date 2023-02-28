import EmptyState from './EmptyState';
import { Label, Spinner, Table, VBox } from './common';
import { useAppContext } from './providers/AppProvider';

export default function QueryResult() {
  const { editorSelectedTab, editorTabs, isRunningSql } = useAppContext();
  const queryRes = editorTabs[editorSelectedTab]?.queryRes;

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
    <VBox id='query-builder-result' customClasses='overflow-x-auto'>
      {!!queryRes && typeof queryRes === 'string' && <Label>{queryRes}</Label>}
      {!!queryRes && queryRes instanceof Array && !queryRes[0]?.result && (
        <VBox customClasses='ph-no-capture'>{<Table data={queryRes} />}</VBox>
      )}
      {!!queryRes &&
        queryRes instanceof Array &&
        queryRes[0]?.result instanceof Array &&
        queryRes.filter((r: any) => (r.result ?? []).length > 0).length > 0 && (
          <VBox customClasses='ph-no-capture'>
            <Table
              data={queryRes
                .filter((r: any) => (r.result ?? []).length > 0)
                .map((r: any) => r.result ?? [])
                .at(-1)}
            />
          </VBox>
        )}
      {!!queryRes &&
        queryRes instanceof Array &&
        (queryRes[0]?.result ?? []) instanceof Array &&
        queryRes.filter((r: any) => (r.result ?? []).length > 0).length === 0 && (
          <Label>Empty response</Label>
        )}
    </VBox>
  );
}
