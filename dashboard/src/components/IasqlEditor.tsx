import { forwardRef, useCallback, useEffect, useRef } from 'react';
import ReactAce, { IAceEditorProps } from 'react-ace/lib/ace';

import dynamic from 'next/dynamic';

import { useQueryParams } from '@/hooks/useQueryParams';

import QuerySidebar from './QuerySidebar/QuerySidebar';
import { HBox, align, VBox, Spinner, Tab } from './common';
import { ActionType, useAppContext } from './providers/AppProvider';

const AceEdit = dynamic(
  async () => {
    require('ace-builds/src-noconflict/ace');
    const ace = await import('./AceEditor');
    require('ace-builds/src-noconflict/ext-language_tools');
    require('ace-builds/src-noconflict/theme-monokai');
    require('ace-builds/src-noconflict/mode-pgsql');
    require('ace-builds/src-noconflict/theme-tomorrow');
    return ace;
  },
  { ssr: false },
);

const ForwardRefEditor = forwardRef((props: IAceEditorProps, ref: any) => (
  <AceEdit props={props} editorRef={ref} />
));
ForwardRefEditor.displayName = 'ForwardRefEditor';

export default function IasqlEditor() {
  const {
    dispatch,
    isDarkMode,
    selectedDb,
    isRunningSql,
    installedModules,
    functions,
    token,
    editorTabs,
    editorSelectedTab,
    forceRun,
  } = useAppContext();
  const editorRef = useRef(null as null | ReactAce);
  const prevTabsLenRef = useRef(null as null | number);
  const queryParams = useQueryParams();

  // Handlers
  const getInitialQuery = useCallback((sql: string | null) => {
    let initialQuery = 'SELECT * FROM iasql_help();';
    if (sql && sql.length > 0) initialQuery = sql;
    return initialQuery;
  }, []);

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

  const onTabChange = (i: number) => {
    dispatch({
      action: ActionType.EditorSelectTab,
      data: { index: i === editorTabs.length - 1 ? i - 1 : i },
    });
  };

  const onTabClose = (i: number) => {
    dispatch({
      action: ActionType.EditorCloseTab,
      data: { index: i },
    });
  };

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

  useEffect(() => {
    if (editorTabs.length !== prevTabsLenRef.current) {
      dispatch({
        token,
        action: ActionType.EditorSelectTab,
        data: {
          index: editorTabs.length - 2 >= 0 ? editorTabs.length - 2 : 0,
          forceRun,
          editorTabs,
          selectedDb,
          isRunningSql,
        },
      });
    }
  }, [editorTabs, dispatch, forceRun, selectedDb, isRunningSql, token]);

  useEffect(() => {
    if (!prevTabsLenRef.current || prevTabsLenRef.current !== editorTabs.length) {
      prevTabsLenRef.current = editorTabs.length;
    }
  }, [editorTabs]);

  return (
    <VBox customClasses='mb-3'>
      <HBox alignment={align.between}>
        {!functions?.length ? <Spinner /> : <QuerySidebar />}
        <VBox id='tabs-and-editor' customClasses='w-full' height='h-50vh'>
          <Tab
            tabs={editorTabs}
            defaultIndex={editorSelectedTab}
            onChange={onTabChange}
            selectedIndex={editorSelectedTab}
            onTabClose={onTabClose}
          ></Tab>
          <ForwardRefEditor
            ref={editorRef}
            // `dark:` selector is not working here, I guess it is not compatible with AceEditor component
            className='border-none'
            width='100%'
            height='100%'
            name='iasql-editor'
            value={editorTabs[editorSelectedTab].content}
            onChange={handleEditorContentUpdate}
            mode='pgsql'
            setOptions={{
              useWorker: false,
              enableBasicAutocompletion: true,
              enableLiveAutocompletion: true,
              enableSnippets: false,
              showLineNumbers: true,
              tabSize: 2,
              theme: isDarkMode ? 'ace/theme/monokai' : 'ace/theme/tomorrow',
            }}
          />
        </VBox>
      </HBox>
    </VBox>
  );
}
