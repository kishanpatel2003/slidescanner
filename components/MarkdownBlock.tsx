'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Markdown } from 'tiptap-markdown';

export interface MarkdownBlockHandle {
  focus: () => void;
}

interface Props {
  value: string;
  onChange: (markdown: string) => void;
}

const EDIT_DEBOUNCE_MS = 300;

/** Rich inline markdown editor; emits serialized markdown on every edit. */
const MarkdownBlock = forwardRef<MarkdownBlockHandle, Props>(function MarkdownBlock(
  { value, onChange },
  ref,
) {
  const lastEmitted = useRef(value);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm prose-slate max-w-none focus:outline-none min-h-6 ' +
          'prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 ' +
          'prose-table:my-2 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1',
      },
    },
    onUpdate: ({ editor }) => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => {
        const markdown = editor.storage.markdown.getMarkdown() as string;
        lastEmitted.current = markdown;
        onChange(markdown);
      }, EDIT_DEBOUNCE_MS);
    },
  });

  useImperativeHandle(ref, () => ({ focus: () => editor?.commands.focus('end') }), [editor]);

  // Adopt external content changes (e.g. a re-run extraction) unless the user is mid-edit.
  useEffect(() => {
    if (!editor || editor.isFocused || value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(value);
  }, [editor, value]);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );

  return <EditorContent editor={editor} />;
});

export default MarkdownBlock;
