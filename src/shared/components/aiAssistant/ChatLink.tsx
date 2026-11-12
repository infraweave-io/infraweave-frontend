import React from 'react';
import { useHref, useNavigate } from 'react-router-dom';
import { resolveInternalLink } from './chatLinks';

interface ChatLinkProps {
  href?: string;
  children?: React.ReactNode;
  /** Called after the link took the user to another page, so the chat can get out of the way. */
  onNavigate: () => void;
}

/**
 * Renders a link from an assistant reply. A link to a page of this app navigates without a
 * reload. Every other link is shown as plain text: the model can get a page wrong, and text it
 * read in a module or a policy could talk it into linking somewhere else, with data in the
 * address. The user can never be taken to another site from the chat.
 */
export const ChatLink: React.FC<ChatLinkProps> = ({ href, children, onNavigate }) => {
  const navigate = useNavigate();
  const target = resolveInternalLink(href);
  // The router's own href keeps "open in new tab" right when the app is served under a base path.
  const routerHref = useHref(target ?? '/');

  if (target) {
    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      navigate(target);
      onNavigate();
    };

    return (
      <a href={routerHref} onClick={handleClick}>
        {children}
      </a>
    );
  }

  return <>{children}</>;
};
