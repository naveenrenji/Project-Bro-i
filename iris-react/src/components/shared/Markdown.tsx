/**
 * Markdown Component
 * Renders markdown content with proper styling for the dark theme
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface MarkdownProps {
  children: string
  className?: string
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn('prose prose-invert prose-sm max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Bold text - ensure visibility on dark background
        strong: ({ children }) => (
          <strong className="font-semibold text-white">{children}</strong>
        ),
        
        // Emphasis/italic
        em: ({ children }) => (
          <em className="text-[var(--color-text-secondary)] italic">{children}</em>
        ),
        
        // Links - open in new tab with accent color
        a: ({ href, children }) => (
          <a 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-[var(--color-accent-primary)] hover:underline"
          >
            {children}
          </a>
        ),
        
        // Inline and block code
        code: ({ children, className }) => {
          const isInline = !className
          return isInline ? (
            <code className="px-1.5 py-0.5 rounded bg-[var(--color-bg-base)] text-sm font-mono text-[var(--color-text-secondary)]">
              {children}
            </code>
          ) : (
            <code className={cn('font-mono', className)}>{children}</code>
          )
        },
        
        // Code blocks
        pre: ({ children }) => (
          <pre className="p-3 rounded-lg bg-[var(--color-bg-base)] overflow-x-auto text-sm">
            {children}
          </pre>
        ),
        
        // Paragraphs
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 text-[var(--color-text-primary)]">{children}</p>
        ),
        
        // Headings
        h1: ({ children }) => (
          <h1 className="text-xl font-bold text-white mb-2">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-bold text-white mb-2">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold text-white mb-1">{children}</h3>
        ),
        
        // Lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-[var(--color-text-primary)]">{children}</li>
        ),
        
        // Tables (GFM)
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2">
            <table className="min-w-full border-collapse text-sm">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-[var(--color-border-subtle)]">
            {children}
          </thead>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-semibold text-white">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-[var(--color-text-secondary)] border-b border-[var(--color-border-subtle)]">
            {children}
          </td>
        ),
        
        // Blockquote
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[var(--color-accent-primary)] pl-3 my-2 text-[var(--color-text-muted)] italic">
            {children}
          </blockquote>
        ),
        
        // Horizontal rule
        hr: () => (
          <hr className="my-3 border-[var(--color-border-subtle)]" />
        ),
      }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
