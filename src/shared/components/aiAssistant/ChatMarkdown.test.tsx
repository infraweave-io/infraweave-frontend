import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ChatMarkdown } from './ChatMarkdown';

const Where = () => {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{`${pathname}${search}`}</div>;
};

const renderReply = (markdown: string, onNavigate = vi.fn()) => {
  const { container } = render(
    <MemoryRouter initialEntries={['/infraweave/overview']}>
      <ChatMarkdown onNavigate={onNavigate}>{markdown}</ChatMarkdown>
      <Where />
    </MemoryRouter>,
  );
  return { container, onNavigate };
};

describe('ChatMarkdown links', () => {
  it('navigates inside the app for a link to a page of the app', async () => {
    const { onNavigate } = renderReply(
      'See [the module](/infraweave/module/stable/s3bucket/1.0.0).',
    );

    await userEvent.click(screen.getByRole('link', { name: 'the module' }));

    expect(screen.getByTestId('where')).toHaveTextContent(
      '/infraweave/module/stable/s3bucket/1.0.0',
    );
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a markdown link to another site', '[docs](https://example.com/docs?token=secret)'],
    ['a markdown link over http', '[docs](http://example.com/docs)'],
    ['a protocol-relative link', '[docs](//example.com/docs?token=secret)'],
    [
      'a bare URL, which markdown turns into a link',
      'See https://example.com/docs?token=secret now',
    ],
    ['a www address, which markdown turns into a link', 'See www.example.com/docs now'],
    ['an email address, which markdown turns into a link', 'Write to someone@example.com now'],
    ['a mailto link', '[mail](mailto:someone@example.com)'],
    ['a javascript link', '[run](javascript:alert(1))'],
    ['a link reference', '[docs][1]\n\n[1]: https://example.com/docs?token=secret'],
    ['a path that is not a page of the app', '[docs](/somewhere/else)'],
  ])('is not a link for %s', (_name, markdown) => {
    const { container } = renderReply(markdown);

    expect(container.querySelector('a')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('keeps the words of a link it does not make clickable', () => {
    renderReply('Read [the docs](https://example.com/docs?token=secret) first.');

    expect(screen.getByText(/Read the docs first\./)).toBeInTheDocument();
  });
});

describe('ChatMarkdown images and raw HTML', () => {
  it.each([
    ['an image from another site', '![chart](https://example.com/p.png?token=secret)'],
    ['an image without a description', '![](https://example.com/p.png?token=secret)'],
    ['an image from the app itself', '![chart](/infraweave/overview)'],
    ['an image reference', '![chart][1]\n\n[1]: https://example.com/p.png?token=secret'],
    ['an image inside a link', '[![chart](https://example.com/p.png)](/infraweave/modules)'],
  ])('does not load %s', (_name, markdown) => {
    const { container } = renderReply(markdown);

    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the description of an image it does not load', () => {
    renderReply('![the chart](https://example.com/p.png?token=secret)');

    expect(screen.getByText('the chart')).toBeInTheDocument();
  });

  it.each([
    ['a link', '<a href="https://example.com/?token=secret">click</a>'],
    ['an image', '<img src="https://example.com/p.png?token=secret">'],
    ['an iframe', '<iframe src="https://example.com/?token=secret"></iframe>'],
    ['a form', '<form action="https://example.com/"><button>go</button></form>'],
    ['a script', '<script>fetch("https://example.com/?token=secret")</script>'],
    ['a stylesheet link', '<link rel="stylesheet" href="https://example.com/x.css">'],
  ])('does not turn raw HTML for %s into elements', (_name, markdown) => {
    const { container } = renderReply(markdown);

    expect(container.querySelector('a, img, iframe, form, script, link, button, style')).toBeNull();
  });
});
