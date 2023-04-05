import EmptyState from './EmptyState';
import { Label, Spinner, AWSSpinner, Table, VBox } from './common';
import { useAppContext } from './providers/AppProvider';

export default function QueryResult() {
  const { editorSelectedTab, editorTabs } = useAppContext();
  const queryRes = editorTabs[editorSelectedTab]?.queryRes;
  const query = editorTabs[editorSelectedTab]?.content;
  const longRunningRpc = query.includes('iasql_commit(') || query.includes('iasql_install(');

  // TODO: show all statements with its respective query and not just the last one
  return editorTabs?.[editorSelectedTab]?.isRunning ? (
    longRunningRpc ? (
      <VBox>
        <p className='pt-20 px-20 font-bold'>
          Cloud operations can take several minutes due to default cloud SDK rate limiters depending on the
          number of resources in the cloud account. Please be patient.
        </p>
        <AWSSpinner />
      </VBox>
    ) : (
      <Spinner />
    )
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
              dataTypes={queryRes
                .filter((r: any) => (r.result ?? []).length > 0)
                .map((r: any) => r.types)
                .at(-1)}
            />
          </VBox>
        )}

      {!!queryRes &&
        queryRes instanceof Array &&
        !!queryRes[0] &&
        !('affected_records' in queryRes[0]) &&
        (queryRes[0]?.result ?? []) instanceof Array &&
        queryRes.filter((r: any) => (r.result ?? []).length > 0).length === 0 && (
          <Label>Empty response</Label>
        )}
    </VBox>
  );
}
