import { useCallback, useEffect, useMemo, useRef } from 'react';
import AceEditor from 'react-ace';
import ReactAce from 'react-ace/lib/ace';

import 'ace-builds/src-noconflict/ext-language_tools';
import 'ace-builds/src-noconflict/mode-pgsql';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/theme-tomorrow';
import LZString from 'lz-string';
import Cookies from 'universal-cookie';

import { ActionType, useAppContext } from '../AppProvider';
import { useQueryParams } from '../hooks/useQueryParams';
import QuerySidebar from './QuerySidebar/QuerySidebar';
import { HBox, align, VBox, Spinner } from './common';

export default function IasqlEditor() {
  const {
    dispatch,
    isDarkMode,
    editorContent,
    selectedDb,
    isRunningSql,
    installedModules,
    functions,
    token,
  } = useAppContext();
  const editorRef = useRef(null as null | ReactAce);
  const cookies = useMemo(() => new Cookies(), []);
  const queryParams = useQueryParams();

  // Handlers
  const getInitialQuery = useCallback(
    (sql: string | null) => {
      let initialQuery = 'SELECT * FROM iasql_help();';
      if (sql && sql.length > 0) initialQuery = sql;
      // check if the query is an ID for the cookie
      const regexExp = /^[a-f0-9]{64}$/gi;
      if (regexExp.test(initialQuery)) {
        const queryContent = cookies.get(initialQuery);
        if (queryContent) {
          // decompress it
          initialQuery = decodeURIComponent(LZString.decompressFromBase64(queryContent) ?? '');
        }
      }
      return initialQuery;
    },
    [cookies],
  );

  const handleEditorContentUpdate = useCallback(
    (content: string) => {
      dispatch({ action: ActionType.EditContent, data: { content } });
    },
    [dispatch],
  );

  const handleQueryToRunUpdate = useCallback(
    (db: any, isRunning: boolean) => {
      const contentToBeRun = editorRef?.current?.editor?.getSelectedText()
        ? editorRef?.current?.editor?.getSelectedText()
        : editorRef?.current?.editor?.getValue();
      if (token && contentToBeRun) {
        dispatch({
          token,
          action: ActionType.RunSql,
          data: {
            db,
            content: contentToBeRun,
            isRunning,
          },
        });
      }
    },
    [dispatch, token],
  );

  // Set up initial query in editor content
  useEffect(() => {
    handleEditorContentUpdate(getInitialQuery(queryParams.get('sql')));
  }, [getInitialQuery, handleEditorContentUpdate, queryParams]);

  // Set up command to enable Ctrl-Enter runs
  useEffect(() => {
    const command = {
      name: 'Run SQL',
      bindKey: { win: 'Ctrl-Enter', mac: 'Cmd-Enter' },
      exec: () => handleQueryToRunUpdate(selectedDb, isRunningSql),
    };
    editorRef?.current?.editor?.commands?.removeCommand(command);
    editorRef?.current?.editor?.commands?.addCommand(command);
  }, [handleQueryToRunUpdate, isRunningSql, selectedDb]);

  // Set up editor theme
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      const isDark = localStorage.getItem('theme') === 'dark';
      if (isDark && editorRef?.current?.editor?.getTheme() === 'ace/theme/tomorrow') {
        editorRef?.current?.editor?.setTheme('ace/theme/monokai');
      } else if (!isDark && editorRef?.current?.editor?.getTheme() === 'ace/theme/monokai') {
        editorRef?.current?.editor?.setTheme('ace/theme/tomorrow');
      }
    });
    observer.observe(root, { attributes: true });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      const isDark = event.matches;
      editorRef?.current?.editor?.setTheme(isDark ? 'ace/theme/monokai' : 'ace/theme/tomorrow');
    });
  }, []);

  // Set up editor autocomplete settings
  useEffect(() => {
    // https://stackoverflow.com/questions/53622096/how-to-specify-a-list-of-custom-tokens-to-list-for-autocompletion-in-ace-editor
    editorRef?.current?.editor?.completers?.push({
      getCompletions: (_editor: any, _session: any, _pos: any, _prefix: any, callback: any) => {
        const completions: any[] = [];
        // we can use session and pos here to decide what we are going to show
        const autoCompleteIasqlKeywords = [
          // Table Names
          ...Object.values(installedModules)
            .map(mod => Object.keys(mod))
            .flat()
            .map(value => ({ value, meta: 'Table' })),
          // Column Names
          ...Object.values(installedModules)
            .map(mod => Object.values(mod))
            .flat()
            .map(tbl => Object.entries(tbl).map(([value, meta]) => ({ value, meta })))
            .flat(),
          // Function Names
          ...(Array.from(functions) ?? [])
            .filter((h: any) => !!h?.signature)
            .map((h: any) => ({ value: h.signature, meta: 'function' })),
        ];
        autoCompleteIasqlKeywords?.push({ value: 'iasql_help()', meta: 'function' });
        autoCompleteIasqlKeywords?.forEach(completion => {
          completions.push(completion);
        });
        callback(null, completions);
      },
    });
  }, [installedModules, functions]);

  // TODO: Handle this in app context
  if (!('theme' in localStorage)) {
    localStorage.setItem(
      'theme',
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    );
  }

  return (
    <VBox>
      <HBox alignment={align.between}>
        {!functions.length ? <Spinner /> : <QuerySidebar />}
        <AceEditor
          ref={editorRef}
          // `dark:` selector is not working here, I guess it is not compatible with AceEditor component
          className={`my-3 ${isDarkMode ? 'border-none' : 'border'}`}
          width='80%'
          height='50vh'
          name='iasql-editor'
          mode='pgsql'
          value={editorContent}
          onChange={handleEditorContentUpdate}
          setOptions={{
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: false,
            showLineNumbers: true,
            tabSize: 2,
            theme: isDarkMode ? 'ace/theme/monokai' : 'ace/theme/tomorrow',
          }}
        />
      </HBox>
    </VBox>
  );
}
