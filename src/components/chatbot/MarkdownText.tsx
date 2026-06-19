'use client';

import React from 'react';

// Splits a line into inline segments: bold, image, link, or plain text.
function renderInline(line: string, lineKey: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Matches (in order): ![alt](url), [text](url), **text**
  const pattern = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    // Push any plain text before this match
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }

    if (match[0].startsWith('![')) {
      // Inline image
      parts.push(
        <img
          key={`img-${lineKey}-${match.index}`}
          src={match[2]}
          alt={match[1] || 'product'}
          className="inline-block max-w-full rounded-lg my-1 align-middle"
          style={{ maxHeight: '160px', objectFit: 'cover' }}
          loading="lazy"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />,
      );
    } else if (match[0].startsWith('[')) {
      // Inline link
      parts.push(
        <a
          key={`a-${lineKey}-${match.index}`}
          href={match[4]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-amber-400 transition-colors break-all"
        >
          {match[3]}
        </a>,
      );
    } else if (match[0].startsWith('**')) {
      // Bold
      parts.push(
        <strong key={`b-${lineKey}-${match.index}`} className="font-semibold text-text-primary">
          {match[5]}
        </strong>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining plain text
  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return parts;
}

interface MarkdownTextProps {
  text: string;
  className?: string;
}

export function MarkdownText({ text, className = '' }: MarkdownTextProps) {
  const lines = text.split('\n');

  return (
    <span className={`text-sm text-text-primary font-light leading-relaxed break-words overflow-wrap-anywhere ${className}`}
      style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
    >
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {renderInline(line, String(i))}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </span>
  );
}
