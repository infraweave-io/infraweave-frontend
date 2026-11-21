import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdoptionHealthPage } from './AdoptionHealthPage';

describe('AdoptionHealthPage dashboard', () => {
  it('does not offer the Deployment Explorer while it is under development', () => {
    render(
      <MemoryRouter initialEntries={['/infraweave/adoption-health']}>
        <Routes>
          <Route path="/infraweave/adoption-health/:view?" element={<AdoptionHealthPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Adoption & Health' })).toBeInTheDocument();
    expect(screen.queryByText('Deployment Explorer')).not.toBeInTheDocument();
  });
});
