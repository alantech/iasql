import { useAppContext } from './AppProvider';
import EmptyState from './EmptyState';
import { Label, Spinner, Table, VBox } from './common';

export default function QueryResult() {
  const { editorSelectedTab, editorTabs, isRunningSql } = useAppContext();

  // TODO: show all statements with its respective query and not just the last one
  return isRunningSql ? (
    <Spinner />
  ) : editorTabs[editorSelectedTab].queryRes === undefined ? (
    <EmptyState>
      <p>No query results</p>
      <p className='font-normal'>
        Enter a query and click <strong>Run query</strong>
      </p>
    </EmptyState>
  ) : (
    <VBox id='query-builder-result' customStyles='overflow-x-auto'>
      {!!editorTabs[editorSelectedTab].queryRes &&
        typeof editorTabs[editorSelectedTab].queryRes === 'string' && (
          <Label>{editorTabs[editorSelectedTab].queryRes}</Label>
        )}
      {!!editorTabs[editorSelectedTab].queryRes &&
        editorTabs[editorSelectedTab].queryRes instanceof Array &&
        !editorTabs[editorSelectedTab].queryRes[0]?.result && (
          <VBox>{<Table data={editorTabs[editorSelectedTab].queryRes} />}</VBox>
        )}
      {!!editorTabs[editorSelectedTab].queryRes &&
        editorTabs[editorSelectedTab].queryRes instanceof Array &&
        editorTabs[editorSelectedTab].queryRes[0]?.result instanceof Array &&
        editorTabs[editorSelectedTab].queryRes.filter((r: any) => (r.result ?? []).length > 0).length > 0 && (
          <Table
            data={editorTabs[editorSelectedTab].queryRes
              .filter((r: any) => (r.result ?? []).length > 0)
              .map((r: any) => r.result ?? [])
              .at(-1)}
          />
        )}
      {!!editorTabs[editorSelectedTab].queryRes &&
        editorTabs[editorSelectedTab].queryRes instanceof Array &&
        (editorTabs[editorSelectedTab].queryRes[0]?.result ?? []) instanceof Array &&
        editorTabs[editorSelectedTab].queryRes.filter((r: any) => (r.result ?? []).length > 0).length ===
          0 && <Label>Empty response</Label>}
    </VBox>
  );
}
