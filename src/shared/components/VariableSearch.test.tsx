import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResourceInputs } from './ResourceInputs';
import { ResourceOutputs } from './ResourceOutputs';

const variable = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  type: 'string',
  default: null,
  nullable: false,
  sensitive: false,
  description: '',
  ...extra,
});

const copyButtons = () => screen.queryAllByRole('button', { name: 'Copy variable name' });

describe('ResourceInputs search', () => {
  it('fuzzy-matches module inputs by their camelCase name', async () => {
    render(
      <ResourceInputs
        inputs={[variable('bucket_name'), variable('enable_versioning'), variable('tags')]}
        view="manifest"
        resourceType="module"
      />,
    );

    await userEvent.type(screen.getByRole('textbox', { name: 'Search inputs' }), 'bktNm');

    expect(screen.getByText('bucketName')).toBeInTheDocument();
    expect(screen.queryByText('enableVersioning')).not.toBeInTheDocument();
    expect(copyButtons()).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('2 hidden by search');
  });

  it('matches stack inputs by sub-claim', async () => {
    render(
      <ResourceInputs
        inputs={[
          variable('bucket1a__bucket_name'),
          variable('bucket1a__tags'),
          variable('queue__queue_name'),
        ]}
        view="manifest"
        resourceType="stack"
      />,
    );

    await userEvent.type(screen.getByRole('textbox', { name: 'Search inputs' }), 'bucket1a');

    expect(copyButtons()).toHaveLength(2);
    expect(screen.queryByText('queueName')).not.toBeInTheDocument();
  });

  it('falls back to a literal match on the description', async () => {
    render(
      <ResourceInputs
        inputs={[
          variable('kms_key_arn', { description: 'Key used for encryption at rest' }),
          variable('tags', { description: 'Extra tags' }),
        ]}
        view="manifest"
        resourceType="module"
      />,
    );

    await userEvent.type(screen.getByRole('textbox', { name: 'Search inputs' }), 'encryption');

    expect(screen.getByText('kmsKeyArn')).toBeInTheDocument();
    expect(copyButtons()).toHaveLength(1);
  });

  it('says when nothing matches rather than that there are no inputs', async () => {
    render(<ResourceInputs inputs={[variable('tags')]} view="manifest" resourceType="module" />);

    await userEvent.type(screen.getByRole('textbox', { name: 'Search inputs' }), 'zzz');

    expect(screen.getByText('No inputs match “zzz”.')).toBeInTheDocument();
  });
});

describe('ResourceOutputs search', () => {
  it('fuzzy-matches stack outputs by property name across sub-claims', async () => {
    render(
      <ResourceOutputs
        outputs={[
          { name: 'bucket1a__bucket_arn', description: '' },
          { name: 'bucket2__bucket_arn', description: '' },
          { name: 'queue__queue_url', description: '' },
        ]}
        view="manifest"
        resourceType="stack"
      />,
    );

    await userEvent.type(screen.getByRole('textbox', { name: 'Search outputs' }), 'bktarn');

    expect(screen.queryAllByRole('button', { name: 'Copy output name' })).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('1 hidden by search');
  });

  it('says when nothing matches rather than that there are no outputs', async () => {
    render(
      <ResourceOutputs
        outputs={[{ name: 'bucket_arn', description: '' }]}
        view="manifest"
        resourceType="module"
      />,
    );

    await userEvent.type(screen.getByRole('textbox', { name: 'Search outputs' }), 'zzz');

    expect(screen.getByText('No outputs match “zzz”.')).toBeInTheDocument();
  });
});
