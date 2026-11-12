import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ChatLink } from './ChatLink';

const Where = () => {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{`${pathname}${search}`}</div>;
};

const renderLink = (href: string | undefined, onNavigate = vi.fn()) => {
  render(
    <MemoryRouter initialEntries={['/infraweave/overview']}>
      <ChatLink href={href} onNavigate={onNavigate}>
        go there
      </ChatLink>
      <Where />
    </MemoryRouter>,
  );
  return onNavigate;
};

describe('ChatLink', () => {
  it('goes to the page inside the app and tells the chat to minimize', async () => {
    const onNavigate = renderLink('/infraweave/module/stable/s3bucket/1.0.0');

    await userEvent.click(screen.getByRole('link', { name: 'go there' }));

    expect(screen.getByTestId('where')).toHaveTextContent(
      '/infraweave/module/stable/s3bucket/1.0.0',
    );
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('keeps the usage filters when it goes', async () => {
    renderLink('/infraweave/adoption-health/module-usage?module=s3bucket&kind=module');

    await userEvent.click(screen.getByRole('link', { name: 'go there' }));

    expect(screen.getByTestId('where')).toHaveTextContent(
      '/infraweave/adoption-health/module-usage?module=s3bucket&kind=module',
    );
  });

  it('minimizes even when only the query changes', async () => {
    const onNavigate = vi.fn();
    render(
      <MemoryRouter
        initialEntries={['/infraweave/adoption-health/module-usage?module=vpc&kind=module']}
      >
        <ChatLink
          href="/infraweave/adoption-health/module-usage?module=s3bucket&kind=module"
          onNavigate={onNavigate}
        >
          go there
        </ChatLink>
        <Where />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('link', { name: 'go there' }));

    expect(screen.getByTestId('where')).toHaveTextContent('module=s3bucket');
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('leaves a modified click to the browser, so it can open a new tab', async () => {
    const onNavigate = renderLink('/infraweave/modules');

    fireEvent.click(screen.getByRole('link', { name: 'go there' }), { ctrlKey: true });

    expect(screen.getByTestId('where')).toHaveTextContent('/infraweave/overview');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it.each([
    ['a page the app does not have', '/infraweave/billing'],
    ['a version page with a part missing', '/infraweave/module/stable/s3bucket'],
    ['a path outside the app', '/somewhere/else'],
    ['no target at all', undefined],
  ])('shows %s as plain text, not a link', async (_name, href) => {
    const onNavigate = renderLink(href);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('go there')).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it.each([
    ['a link to another site', 'https://example.com/docs?token=secret'],
    ['a link to another site over http', 'http://example.com/docs'],
    ['a protocol-relative link', '//example.com/docs'],
    ['a mailto link', 'mailto:someone@example.com'],
    ['a javascript link', 'javascript:alert(1)'],
  ])('shows %s as plain text, never as a link', (_name, href) => {
    const onNavigate = renderLink(href);

    expect(screen.queryByRole('link')).toBeNull();
    expect(document.querySelector('a')).toBeNull();
    expect(screen.getByText('go there')).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
