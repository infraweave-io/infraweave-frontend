import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table, TableColumn } from './ComponentAdapter';

const rows = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ name: `row-${i}`, detail: `detail-${i}` }));

const columns: TableColumn<{ name: string; detail: string }>[] = [
  { title: 'Name', field: 'name' },
  { title: 'Detail', field: 'detail' },
];

const renderTable = (props: Partial<React.ComponentProps<typeof Table>> = {}) =>
  render(<Table columns={columns as TableColumn[]} data={rows(25)} {...props} />);

describe('Table', () => {
  it('renders every row when paging is off', () => {
    renderTable({ options: { paging: false } });

    expect(screen.getByText('row-0')).toBeInTheDocument();
    expect(screen.getByText('row-24')).toBeInTheDocument();
  });

  it('renders one page at a time when paging is on', () => {
    renderTable({ options: { paging: true, pageSize: 10 } });

    expect(screen.getByText('row-0')).toBeInTheDocument();
    expect(screen.getByText('row-9')).toBeInTheDocument();
    expect(screen.queryByText('row-10')).not.toBeInTheDocument();
  });

  it('counts the whole list, not the page', () => {
    renderTable({ options: { paging: true, pageSize: 10 } });

    expect(screen.getByText('1–10 of 25')).toBeInTheDocument();
  });

  it('moves to the next page', async () => {
    renderTable({ options: { paging: true, pageSize: 10 } });

    await userEvent.click(screen.getByRole('button', { name: /next page/i }));

    expect(screen.getByText('row-10')).toBeInTheDocument();
    expect(screen.queryByText('row-0')).not.toBeInTheDocument();
  });

  it('falls back to the last page when the data shrinks under it', async () => {
    const { rerender } = renderTable({ options: { paging: true, pageSize: 10 } });
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText('row-20')).toBeInTheDocument();

    rerender(
      <Table
        columns={columns as TableColumn[]}
        data={rows(12)}
        options={{ paging: true, pageSize: 10 }}
      />,
    );

    expect(screen.getByText('row-10')).toBeInTheDocument();
    expect(screen.getByText('11–12 of 12')).toBeInTheDocument();
  });

  it('stays on the page it fell back to when the data grows again', async () => {
    const { rerender } = renderTable({ options: { paging: true, pageSize: 10 } });
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    const renderRows = (count: number) =>
      rerender(
        <Table
          columns={columns as TableColumn[]}
          data={rows(count)}
          options={{ paging: true, pageSize: 10 }}
        />,
      );

    renderRows(5);
    renderRows(25);

    expect(screen.getByText('1–10 of 25')).toBeInTheDocument();
  });

  it('offers the page sizes it was given', async () => {
    renderTable({ options: { paging: true, pageSize: 10, pageSizeOptions: [10, 25] } });

    await userEvent.click(screen.getByRole('combobox'));

    expect(screen.getByRole('option', { name: '25' })).toBeInTheDocument();
  });

  it('shows the whole list when the page size grows', async () => {
    renderTable({ options: { paging: true, pageSize: 10, pageSizeOptions: [10, 25] } });

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: '25' }));

    expect(screen.getByText('row-24')).toBeInTheDocument();
  });

  describe('search', () => {
    it('has no search box unless asked for one', () => {
      renderTable({ options: { paging: false } });

      expect(screen.queryByRole('textbox', { name: /search table/i })).not.toBeInTheDocument();
    });

    it('narrows the rows to those matching a field, ignoring case', async () => {
      renderTable({ options: { search: true } });

      await userEvent.type(screen.getByRole('textbox', { name: /search table/i }), 'DETAIL-12');

      expect(screen.getByText('row-12')).toBeInTheDocument();
      expect(screen.queryByText('row-1')).not.toBeInTheDocument();
    });

    it('pages and counts the matching rows only', async () => {
      renderTable({ options: { search: true, paging: true, pageSize: 10 } });
      await userEvent.click(screen.getByRole('button', { name: /next page/i }));

      await userEvent.type(screen.getByRole('textbox', { name: /search table/i }), 'row-2');

      // row-2 and row-20 to row-24, from the first page again.
      expect(screen.getByText('1–6 of 6')).toBeInTheDocument();
      expect(screen.getByText('row-2')).toBeInTheDocument();
    });

    it('matches text inside elements put in a field', async () => {
      const VersionCell = ({ version }: { version: string }) => <span>{version}</span>;
      const data = [
        { name: <a href="/d/alpha">deploy-alpha</a>, detail: <VersionCell version="1.2.3" /> },
        { name: <a href="/d/beta">deploy-beta</a>, detail: <VersionCell version="4.5.6" /> },
      ];
      render(<Table columns={columns as TableColumn[]} data={data} options={{ search: true }} />);
      const search = screen.getByRole('textbox', { name: /search table/i });

      await userEvent.type(search, 'alpha');
      expect(screen.getByText('deploy-alpha')).toBeInTheDocument();
      expect(screen.queryByText('deploy-beta')).not.toBeInTheDocument();

      await userEvent.clear(search);
      await userEvent.type(search, '4.5');
      expect(screen.getByText('deploy-beta')).toBeInTheDocument();
      expect(screen.queryByText('deploy-alpha')).not.toBeInTheDocument();
    });

    it('does not match layout props of elements without text', async () => {
      const Icon = (_: { fontSize: string; color: string }) => <svg />;
      const data = [
        { name: 'deploy-alpha', detail: <Icon fontSize="small" color="error" /> },
        { name: 'deploy-beta', detail: <span>small</span> },
      ];
      render(<Table columns={columns as TableColumn[]} data={data} options={{ search: true }} />);
      const search = screen.getByRole('textbox', { name: /search table/i });

      await userEvent.type(search, 'small');
      expect(screen.getByText('deploy-beta')).toBeInTheDocument();
      expect(screen.queryByText('deploy-alpha')).not.toBeInTheDocument();

      await userEvent.clear(search);
      await userEvent.type(search, 'error');
      expect(screen.getByRole('cell', { name: /no rows match/i })).toBeInTheDocument();
    });

    it('clears the search on Escape without letting the key reach a surrounding dialog', async () => {
      const onKeyDown = vi.fn();
      render(
        <div onKeyDown={onKeyDown}>
          <Table columns={columns as TableColumn[]} data={rows(25)} options={{ search: true }} />
        </div>,
      );
      const search = screen.getByRole('textbox', { name: /search table/i });
      await userEvent.type(search, 'row-2');

      await userEvent.keyboard('{Escape}');

      expect(search).toHaveValue('');
      expect(screen.getByText('row-1')).toBeInTheDocument();
      expect(onKeyDown).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }));
    });

    it('announces how many rows match', async () => {
      renderTable({ options: { search: true } });
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('');

      await userEvent.type(screen.getByRole('textbox', { name: /search table/i }), 'row-2');
      expect(status).toHaveTextContent('6 rows match');

      await userEvent.type(screen.getByRole('textbox', { name: /search table/i }), 'x');
      expect(status).toHaveTextContent('No rows match "row-2x"');
    });

    it('says so when nothing matches', async () => {
      renderTable({ options: { search: true } });

      await userEvent.type(screen.getByRole('textbox', { name: /search table/i }), 'nope');

      expect(screen.getByRole('cell', { name: /no rows match/i })).toBeInTheDocument();
    });
  });
});
