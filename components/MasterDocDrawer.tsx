'use client';

import { useEffect, useState } from 'react';
import { wordCount } from '@/lib/master';

interface Props {
  markdown: string;
  deckTitle: string;
  onClose: () => void;
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck';
}

export default function MasterDocDrawer({ markdown, deckTitle, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
  };

  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(deckTitle)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex h-[45vh] flex-col border-t border-slate-300 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-2">
        <h2 className="text-sm font-semibold">Master document</h2>
        <span className="text-xs text-slate-400">{wordCount(markdown)} words</span>
        <span className="flex-1" />
        <button
          onClick={copy}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
        <button
          onClick={download}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          Download .md
        </button>
        <button
          onClick={onClose}
          title="Close (Esc)"
          className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
        >
          Close
        </button>
      </div>
      <pre className="flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-slate-800">
        {markdown}
      </pre>
    </div>
  );
}
