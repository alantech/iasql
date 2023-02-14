import React from 'react';
import type { IAceEditorProps } from 'react-ace';
import AceEditor from 'react-ace';

export default function CodeEditor({ editorRef, props }: { editorRef: any; props: IAceEditorProps }) {
  return <AceEditor {...props} ref={editorRef} />;
}
