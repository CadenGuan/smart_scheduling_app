import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const renderInline = (text: string): React.ReactNode[] => {
    // Regex matching bold **text**, inline code `code`, and italic *text*
    const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-slate-800">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        const codeText = part.slice(1, -1);
        return (
          <code
            key={index}
            className="px-1.5 py-0.5 mx-0.5 rounded-md bg-[#00B4DB]/10 text-[#008ba8] font-bold text-[11px] border border-[#00B4DB]/25 tracking-wide"
          >
            {codeText}
          </code>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={index} className="italic text-slate-700">
            {part.slice(1, -1)}
          </em>
        );
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let isNumbered = false;

  const flushList = (key: number) => {
    if (currentList.length > 0) {
      if (isNumbered) {
        renderedElements.push(
          <ol key={`ol-${key}`} className="list-decimal pl-5 space-y-1 text-xs text-slate-700 my-2">
            {currentList}
          </ol>
        );
      } else {
        renderedElements.push(
          <ul key={`ul-${key}`} className="list-disc pl-5 space-y-1 text-xs text-slate-700 my-2">
            {currentList}
          </ul>
        );
      }
      currentList = [];
    }
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();

    if (!line) {
      flushList(idx);
      return;
    }

    if (line.startsWith('### ')) {
      flushList(idx);
      renderedElements.push(
        <h4
          key={`h3-${idx}`}
          className="text-xs font-bold text-slate-800 uppercase tracking-wider mt-3 mb-1.5"
        >
          {renderInline(line.slice(4))}
        </h4>
      );
      return;
    }

    if (line.startsWith('## ')) {
      flushList(idx);
      renderedElements.push(
        <h3 key={`h2-${idx}`} className="text-sm font-bold text-slate-900 mt-3.5 mb-1.5">
          {renderInline(line.slice(3))}
        </h3>
      );
      return;
    }

    // Unordered list item
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (currentList.length > 0 && isNumbered) {
        flushList(idx);
      }
      isNumbered = false;
      currentList.push(
        <li key={`li-${idx}`} className="leading-relaxed">
          {renderInline(line.slice(2))}
        </li>
      );
      return;
    }

    // Ordered list item (e.g. 1. , 2. )
    const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      if (currentList.length > 0 && !isNumbered) {
        flushList(idx);
      }
      isNumbered = true;
      currentList.push(
        <li key={`oli-${idx}`} className="leading-relaxed">
          {renderInline(numberedMatch[2])}
        </li>
      );
      return;
    }

    // Regular paragraph
    flushList(idx);
    renderedElements.push(
      <p key={`p-${idx}`} className="text-xs text-slate-700 leading-relaxed mb-2 last:mb-0">
        {renderInline(line)}
      </p>
    );
  });

  flushList(lines.length);

  return <div className="space-y-1">{renderedElements}</div>;
};
