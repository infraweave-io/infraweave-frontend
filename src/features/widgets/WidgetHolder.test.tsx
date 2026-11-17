import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { WidgetHolder } from './WidgetHolder';

/** Throws while `broken.current` is set, so a test can mend it before retrying. */
const Flaky = ({ broken }: { broken: { current: boolean } }) => {
  if (broken.current) throw new Error('boom');
  return <p>Widget content</p>;
};

describe('WidgetHolder', () => {
  beforeEach(() => {
    // React logs every caught render error; the test expects them.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a region named by its title', () => {
    render(
      <WidgetHolder title="Failed deployments">
        <p>Widget content</p>
      </WidgetHolder>,
    );

    expect(screen.getByRole('region', { name: 'Failed deployments' })).toHaveTextContent(
      'Widget content',
    );
  });

  it('links to its pages beside the title, without them joining its name', () => {
    render(
      <MemoryRouter>
        <WidgetHolder
          title="Latest releases"
          links={[
            { to: '/infraweave/modules', label: 'Modules' },
            { to: '/infraweave/stacks', label: 'Stacks' },
          ]}
        >
          <p>Widget content</p>
        </WidgetHolder>
      </MemoryRouter>,
    );

    expect(screen.getByRole('region', { name: 'Latest releases' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Modules' })).toHaveAttribute(
      'href',
      '/infraweave/modules',
    );
    expect(screen.getByRole('link', { name: 'Stacks' })).toHaveAttribute(
      'href',
      '/infraweave/stacks',
    );
  });

  it('renders header actions', () => {
    render(
      <WidgetHolder title="Releases" actions={<button>Settings</button>}>
        <p>Widget content</p>
      </WidgetHolder>,
    );

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('contains a crashing widget, leaving the rest of the page alone', () => {
    render(
      <>
        <WidgetHolder title="Broken">
          <Flaky broken={{ current: true }} />
        </WidgetHolder>
        <WidgetHolder title="Healthy">
          <p>Still here</p>
        </WidgetHolder>
      </>,
    );

    expect(screen.getByRole('region', { name: 'Broken' })).toHaveTextContent(
      'This widget failed to load',
    );
    expect(screen.getByRole('region', { name: 'Healthy' })).toHaveTextContent('Still here');
  });

  it('renders the widget again on Retry', async () => {
    const broken = { current: true };
    render(
      <WidgetHolder title="Flaky">
        <Flaky broken={broken} />
      </WidgetHolder>,
    );
    expect(screen.queryByText('Widget content')).not.toBeInTheDocument();

    broken.current = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText('Widget content')).toBeInTheDocument();
    expect(screen.queryByText('This widget failed to load')).not.toBeInTheDocument();
  });

  it('shows the error again when Retry fails too', async () => {
    render(
      <WidgetHolder title="Flaky">
        <Flaky broken={{ current: true }} />
      </WidgetHolder>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText('This widget failed to load')).toBeInTheDocument();
  });
});
