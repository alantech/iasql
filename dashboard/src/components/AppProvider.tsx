import React, { useCallback, useContext, useReducer, useEffect } from 'react';

import * as semver from 'semver';
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';

import * as DbActions from '@/services/dbApi';
import * as Posthog from '@/services/posthog';

const nameGenConfig = {
  dictionaries: [adjectives, colors, animals],
};

const AppContext = React.createContext({} as AppStore);

const useAppContext = () => {
  return useContext(AppContext);
};

export enum ActionType {
  InitialLoad = 'InitialLoad',
  NewDb = 'NewDb',
  List = 'List',
  Disconnect = 'Disconnect',
  Dump = 'Dump',
  ExportDb = 'ExportDb',
  UpgradeDb = 'UpgradeDb',
  DisconnectDb = 'DisconnectDb',
  UninstallModule = 'UninstallModule',
  InstallModule = 'InstallModule',
  SelectDb = 'SelectDb',
  RunSql = 'RunSql',
  RunAutocompleteSql = 'RunAutocompleteSql',
  EditContent = 'EditContent',
  TrackEvent = 'TrackEvent',
  FetchData = 'FetchData',
  Stop = 'Stop',
  ExportedDb = 'ExportedDb',
  RunningSql = 'RunningSql',
  ShowDisconnect = 'ShowDisconnect',
  ShowConnect = 'ShowConnect',
  ResetNewDb = 'ResetNewDb',
  ResetError = 'ResetError',
  SetError = 'SerError',
  EditorNewTab = 'EditorNewTab',
}

interface Payload {
  token?: string;
  action: ActionType;
  // TODO: ADD DATA TYPE!!!
  data?: any;
}

interface AppState {
  token?: string;
  // TODO: ADD DB TYPE!!!
  selectedDb: any;
  oldestVersion?: string;
  latestVersion?: string;
  isRunningSql: boolean;
  databases: any[];
  error: string | null;
  newDb?: any;
  dump: Blob | null;
  editorContent: string;
  allModules: { [moduleName: string]: string[] };
  functions: any[];
  installedModules: { [moduleName: string]: { [tableName: string]: { [columnName: string]: string } } };
  isDarkMode: boolean;
  queryRes?: any | null;
  shouldShowDisconnect: boolean;
  shouldShowConnect: boolean;
  editorTabs: { title: string; action?: () => void; className?: string; width?: string }[];
}

interface AppStore extends AppState {
  dispatch: (payload: Payload) => Promise<void>;
}

const initializingQueries = `
  select * from iasql_help();
  select
    t.module, c.table_name, c.ordinal_position, c.column_name, c.data_type
  from information_schema.columns as c
  inner join iasql_tables as t on c.table_name = t.table
  order by
    table_name, ordinal_position;
  select * from iasql_modules_list();
`;

const reducer = (state: AppState, payload: Payload): AppState => {
  const { error } = payload?.data ?? { error: null };
  if (error) {
    return { ...state, error };
  }
  switch (payload.action) {
    case ActionType.SelectDb:
      const { db } = payload.data;
      db.isUnsupported =
        !semver.valid(db?.version) || (!!state.oldestVersion && semver.lt(db?.version, state.oldestVersion));
      return { ...state, selectedDb: db };
    case ActionType.InitialLoad:
      const { token } = payload;
      const { initialDatabases, latestVersion, oldestVersion } = payload.data;
      return { ...state, databases: initialDatabases, latestVersion, oldestVersion, token };
    case ActionType.NewDb:
      const { newDb, updatedDatabases } = payload.data;
      const newSelectedDb = updatedDatabases.find((d: any) => d.alias === newDb.alias);
      return { ...state, databases: updatedDatabases, selectedDb: newSelectedDb, newDb };
    case ActionType.ResetNewDb:
      return { ...state, newDb: undefined };
    case ActionType.ExportDb:
      const { dump } = payload.data;
      return { ...state, dump };
    case ActionType.ExportedDb:
      return { ...state, dump: null };
    case ActionType.EditContent:
      const { content: editorContent } = payload.data;
      return { ...state, editorContent };
    case ActionType.RunningSql:
      const { isRunning } = payload.data;
      return { ...state, isRunningSql: isRunning };
    case ActionType.RunSql:
      const { queryRes, databases: runSqlUpdatedDbs } = payload.data;
      if (runSqlUpdatedDbs !== null) {
        const current = runSqlUpdatedDbs.find((d: any) => d.alias === state.selectedDb.alias);
        return { ...state, queryRes, databases: runSqlUpdatedDbs, selectedDb: current };
      }
      return { ...state, queryRes };
    case ActionType.RunAutocompleteSql:
      const { autoCompleteRes } = payload.data;
      const moduleData = {} as {
        [moduleName: string]: { [tableName: string]: { [columnName: string]: string } };
      };
      const allModules = {} as { [moduleName: string]: string[] };
      const functionData = new Set() as Set<any>;
      (autoCompleteRes?.[0]?.result ?? []).forEach((e: any) => functionData.add(e));
      (autoCompleteRes?.[1]?.result ?? []).forEach((row: any) => {
        const moduleName = row.module;
        const tableName = row.table_name;
        const columnName = row.column_name;
        const dataType = row.data_type;
        moduleData[moduleName] = moduleData[moduleName] || {};
        moduleData[moduleName][tableName] = moduleData[moduleName][tableName] || {};
        moduleData[moduleName][tableName][columnName] = dataType;
      });
      (autoCompleteRes?.[2]?.result ?? []).forEach((row: any) => {
        const moduleName = row.module_name;
        const moduleDependencies = row.dependencies.join(', ');
        allModules[moduleName] = moduleDependencies;
      });
      return {
        ...state,
        functions: [...(Array.from(functionData) ?? [])],
        allModules,
        installedModules: moduleData,
      };
    case ActionType.InstallModule:
      const { moduleName: installModule } = payload.data;
      const installContent = `/* BEGIN IaSQL auto-generated statement */
SELECT * FROM iasql_install('${installModule}');
/* END IaSQL auto-generated statement */
`;
      return { ...state, editorContent: installContent };
    case ActionType.UninstallModule:
      const { moduleName: uninstallModule } = payload.data;
      const uninstallContent = `/* BEGIN IaSQL auto-generated statement */
SELECT * FROM iasql_uninstall('${uninstallModule}');
/* END IaSQL auto-generated statement */
`;
      return { ...state, editorContent: uninstallContent };
    case ActionType.DisconnectDb:
      const { databases: updatedDbsAfterDisconnect } = payload.data;
      const updatedSelectedDb = updatedDbsAfterDisconnect.length ? updatedDbsAfterDisconnect[0] : null;
      return {
        ...state,
        selectedDb: updatedSelectedDb,
        databases: updatedDbsAfterDisconnect,
        shouldShowDisconnect: false,
      };
    case ActionType.ShowDisconnect:
      const { show } = payload.data;
      return { ...state, shouldShowDisconnect: show };
    case ActionType.ShowConnect:
      const { showConnect } = payload.data;
      return { ...state, shouldShowConnect: showConnect };
    case ActionType.ResetError:
      return { ...state, error: null };
    case ActionType.SetError:
      const { error: customError } = payload.data;
      return { ...state, error: customError };
    case ActionType.EditorNewTab:
      const tabsCopy = [...state.editorTabs];
      const newTab = tabsCopy.pop();
      tabsCopy.push({ title: `Query-${state.editorTabs.length - 1}` });
      if (newTab) tabsCopy.push(newTab);
      return { ...state, editorTabs: tabsCopy };
  }
  return state;
};

const middlewareReducer = async (dispatch: (payload: Payload) => void, payload: Payload) => {
  const { token } = payload;
  switch (payload.action) {
    case ActionType.InitialLoad:
      try {
        const initialDatabases = await DbActions.list(token ?? '');
        const oldestVer = await DbActions.getOldestVersion(token ?? '');
        const latestVer = await DbActions.getLatestVersion(token ?? '');
        dispatch({
          ...payload,
          data: {
            initialDatabases,
            oldestVersion: oldestVer.split('-')[0],
            latestVersion: latestVer.split('-')[0],
          },
        });
        break;
      } catch (e: any) {
        const error = e.message ? e.message : `Unexpected error getting initial load`;
        dispatch({ ...payload, data: { error } });
        break;
      }

    case ActionType.NewDb:
      if (!token) {
        dispatch({ ...payload, data: { error: 'No auth token defined.' } });
        break;
      }
      const { dbAlias, awsSecretAccessKey, awsRegion, awsAccessKeyId, latestVersion } = payload.data;
      const alias = dbAlias ? dbAlias : uniqueNamesGenerator(nameGenConfig);
      let newDb: any = null;
      try {
        newDb = await DbActions.newDb(token, alias);
      } catch (e: any) {
        const error = e.message ? e.message : `Unexpected error connecting database ${alias}`;
        dispatch({ ...payload, data: { error } });
        break;
      }
      try {
        await DbActions.run(
          token,
          alias,
          `
          SELECT * FROM iasql_install('aws_account');
        `,
        );
      } catch (e: any) {
        const error = e.message ? e.message : `Error adding aws_account ${alias}`;
        dispatch({ ...payload, data: { error } });
        break;
      }
      // New DBs will always use the newest module conventions, so this is switched to the two
      // table aws_account form now
      // ${awsRegion.name}
      try {
        await DbActions.run(
          token,
          alias,
          `
          INSERT INTO aws_credentials (access_key_id, secret_access_key)
          VALUES ('${awsAccessKeyId}', '${awsSecretAccessKey}');
        `,
        );
        if (semver.lt(latestVersion ?? '', '0.0.23')) {
          await DbActions.run(
            token,
            alias,
            `
            SELECT * FROM iasql_sync();
          `,
          );
        } else {
          await DbActions.run(
            token,
            alias,
            `
            SELECT * FROM iasql_begin();
          `,
          );
          await DbActions.run(
            token,
            alias,
            `
            SELECT * FROM iasql_commit();
          `,
          );
        }
        await DbActions.run(
          token,
          alias,
          `
          SELECT * FROM default_aws_region('${awsRegion.name}');
        `,
        );
      } catch (e: any) {
        const error = e.message ? e.message : `Error adding credentials ${dbAlias}`;
        dispatch({ ...payload, data: { error } });
        break;
      }
      if (newDb) {
        // update the db list before hiding the modal
        const updatedDatabases = await DbActions.list(token);
        dispatch({ ...payload, data: { newDb, updatedDatabases } });
      }
      break;

    case ActionType.ExportDb:
      if (!token) {
        dispatch({ ...payload, data: { error: 'No auth token defined.' } });
        break;
      }
      const { dbAlias: dumpDbAlias, dataOnly } = payload.data;
      try {
        const dump = await DbActions.dump(token, dumpDbAlias, dataOnly);
        if (dump) {
          dispatch({ ...payload, data: { dump } });
        }
      } catch (e: any) {
        const error = e.message ? e.message : `Unexpected error exporting database ${dbAlias}`;
        dispatch({ ...payload, data: { error } });
        break;
      }
      break;

    case ActionType.RunSql:
      if (!token) {
        dispatch({ ...payload, data: { error: 'No auth token defined.' } });
        break;
      }
      const { content, isRunning, db: runningDb } = payload.data;
      if (runningDb.isUnsupported) {
        break;
      }
      let queryRes: any = 'Invalid or empty response';
      let databases: any[] | null = null;
      let shouldUpdate = false;
      let updatedAutoCompleteRes: any;
      let runErr: any;
      try {
        if (!isRunning) {
          dispatch({ action: ActionType.RunningSql, data: { isRunning: true } });
          try {
            if (token && content) queryRes = await DbActions.run(token, runningDb?.alias, content);
            const compFn = (r: any, stmt: string) =>
              r.statement &&
              typeof r.statement === 'string' &&
              r.statement.toLowerCase().indexOf(stmt) !== -1;
            for (const r of queryRes) {
              if (compFn(r, 'iasql_install(') || compFn(r, 'iasql_uninstall(')) shouldUpdate = true;
            }
            if (shouldUpdate) {
              databases = await DbActions.list(token);
              updatedAutoCompleteRes = await DbActions.run(token, runningDb?.alias, initializingQueries);
            }
          } catch (e: any) {
            queryRes = e.message ? e.message : 'Unhandled error in SQL execution';
          }
        }
      } catch (e: any) {
        runErr = e.message ? e.message : `Unexpected error`;
        dispatch({ ...payload, data: { error: runErr } });
      } finally {
        dispatch({ action: ActionType.RunningSql, data: { isRunning: false } });
        dispatch({
          action: ActionType.TrackEvent,
          data: {
            trackEventName: 'RUN_SQL',
            trackDbAlias: runningDb?.alias,
            queryToRun: content,
            queryOutput: queryRes,
            queryError: runErr,
          },
        });
      }
      if (runErr) break;
      dispatch({ ...payload, data: { queryRes, databases } });
      if (updatedAutoCompleteRes) {
        dispatch({
          ...payload,
          action: ActionType.RunAutocompleteSql,
          data: { autoCompleteRes: updatedAutoCompleteRes },
        });
      }
      break;

    case ActionType.RunAutocompleteSql:
      if (!token) {
        dispatch({ ...payload, data: { error: 'No auth token defined.' } });
        break;
      }
      const { dbAlias: autoCompleteDbAlias } = payload.data;
      try {
        dispatch({ action: ActionType.RunningSql, data: { isRunning: true } });
        const autoCompleteRes = await DbActions.run(token, autoCompleteDbAlias, initializingQueries);
        dispatch({ ...payload, data: { autoCompleteRes } });
      } catch (e: any) {
        const error = e.message ? e.message : `Unexpected error`;
        dispatch({ ...payload, data: { error } });
      } finally {
        dispatch({ action: ActionType.RunningSql, data: { isRunning: false } });
      }
      break;

    case ActionType.DisconnectDb:
      if (!token) {
        dispatch({ ...payload, data: { error: 'No auth token defined.' } });
        break;
      }
      const { dbAlias: disconnectDbAlias } = payload.data;
      try {
        await DbActions.disconnect(token, disconnectDbAlias);
        const afterDisconnectDbs = await DbActions.list(token);
        dispatch({ ...payload, data: { databases: afterDisconnectDbs } });
      } catch (e: any) {
        const error = e.message ? e.message : `Unexpected error disconnecting database ${disconnectDbAlias}`;
        dispatch({ ...payload, data: { error } });
      }
      break;

    case ActionType.TrackEvent:
      if (!token) {
        dispatch({ ...payload, data: { error: 'No auth token defined.' } });
        break;
      }
      const { trackEventName, trackDbAlias, buttonAlias, queryToRun, queryOutput, queryError } = payload.data;
      try {
        if (trackEventName) {
          await Posthog.capture(trackEventName, {
            dbAlias: trackDbAlias,
            buttonAlias,
            sql: queryToRun,
            error: queryError,
            output: queryOutput,
          });
        }
      } catch (e: any) {
        const error = e.message ? e.message : `Unexpected error`;
        dispatch({ ...payload, data: { error } });
      }
      break;

    default:
      dispatch(payload);
  }
};

const AppProvider = ({ children }: { children: any }) => {
  let local: any;
  useEffect(() => {
    local = localStorage;
  });

  const initialState: AppState = {
    selectedDb: null,
    oldestVersion: undefined,
    latestVersion: undefined,
    isRunningSql: false,
    databases: [],
    error: null,
    dump: null,
    editorContent: '',
    allModules: {},
    functions: [],
    installedModules: {},
    isDarkMode: local?.theme === 'dark',
    shouldShowDisconnect: false,
    shouldShowConnect: false,
    editorTabs: [
      { title: 'Welcome' },
      {
        title: '+',
        width: 'w-auto',
        className: 'px-4',
        action: () => {
          dispatch({
            action: ActionType.EditorNewTab,
          });
        },
      },
    ],
  };
  const [state, dispatch] = useReducer(reducer, initialState);
  const customDispatch = useCallback(async (payload: Payload) => {
    middlewareReducer(dispatch, payload);
  }, []);

  return (
    <AppContext.Provider
      value={{
        token: state.token,
        selectedDb: state.selectedDb,
        isDarkMode: state.isDarkMode,
        databases: state.databases,
        error: state.error,
        latestVersion: state.latestVersion,
        oldestVersion: state.oldestVersion,
        newDb: state.newDb,
        dump: state.dump,
        editorContent: state.editorContent,
        allModules: state.allModules,
        functions: state.functions,
        installedModules: state.installedModules,
        isRunningSql: state.isRunningSql,
        queryRes: state.queryRes,
        shouldShowDisconnect: state.shouldShowDisconnect,
        shouldShowConnect: state.shouldShowConnect,
        editorTabs: state.editorTabs,
        dispatch: customDispatch,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export type { AppStore };
export { AppProvider, useAppContext };
