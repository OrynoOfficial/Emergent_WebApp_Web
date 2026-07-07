import React from 'react';

/**
 * Renders a paragraph string that may contain **bold** markdown into a fragment
 * with the bold sections wrapped in <strong>. No other markdown is supported —
 * this is intentionally minimal so we can share it across the static pages
 * without pulling in a full markdown library.
 */
export default function RenderMarkdownLite({ text, className = '' }) {
  if (!text) return null;
  // Split on **...** while keeping the delimiters
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className={className || 'text-gray-600 mb-3 whitespace-pre-line'}>
      {parts.map((chunk, i) => {
        if (chunk.startsWith('**') && chunk.endsWith('**')) {
          return <strong key={i}>{chunk.slice(2, -2)}</strong>;
        }
        return <React.Fragment key={i}>{chunk}</React.Fragment>;
      })}
    </p>
  );
}
