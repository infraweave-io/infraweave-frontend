import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatLink } from './ChatLink';

interface ChatMarkdownProps {
  children: string;
  /** Called after a link took the user to another page, so the chat can get out of the way. */
  onNavigate: () => void;
}

/**
 * Renders an assistant reply. The reply is written by a model that reads module and policy text,
 * which can try to steer it, so nothing in it may reach outside the app: links go through
 * ChatLink, which only follows pages of the app, an image is shown as its description instead of
 * being loaded (a loaded image sends its address, and any data in it, with no click), and raw
 * HTML stays text because no HTML plugin is used.
 */
export const ChatMarkdown: React.FC<ChatMarkdownProps> = ({ children, onNavigate }) => {
  const components = useMemo(
    () => ({
      a: ({ href, children: label }: { href?: string; children?: React.ReactNode }) => (
        <ChatLink href={href} onNavigate={onNavigate}>
          {label}
        </ChatLink>
      ),
      img: ({ alt }: { alt?: string }) => <>{alt}</>,
    }),
    [onNavigate],
  );

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm] as any} components={components}>
      {children}
    </ReactMarkdown>
  );
};
