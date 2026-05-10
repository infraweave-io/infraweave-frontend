import React, { useEffect, useState } from 'react';
import { useConfig } from '../../../hooks/useConfig';
import {
  Table,
  TableColumn,
  Progress,
  ResponseErrorPanel,
  Link,
} from '../../../standalone/components/ComponentAdapter';
import { Policy } from '../../../types/Policy';
import { useSelectedProviders } from '../../root/RootPage/SelectedProvidersContext';

type DenseTableProps = {
  policies: Policy[];
};

export const DenseTable = ({ policies }: DenseTableProps) => {
  const columns: TableColumn[] = [
    { title: 'Policy', field: 'policy' },
    { title: 'Version', field: 'version' },
    { title: 'Variables', field: 'tf_variables' },
  ];

  const data = policies.map((policy) => {
    const encodedPolicyName = encodeURIComponent(policy.policy ?? '');
    const encodedPolicyVersion = encodeURIComponent(policy.version ?? '');
    const encodedEnvironment = encodeURIComponent(policy.environment ?? '');
    const policy_link = `/infraweave/policy/${encodedEnvironment}/${encodedPolicyName}/${encodedPolicyVersion}`;
    return {
      policy: <Link to={policy_link}>{policy.policy}</Link>,
      version: policy.version,
    };
  });

  return (
    <Table
      title="Policies List"
      options={{
        search: true,
        paging: false,
        draggable: true,
        columnResizable: true,
      }}
      columns={columns}
      data={data}
    />
  );
};

export const Policies = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { selectedProviders } = useSelectedProviders();
  const config = useConfig();

  useEffect(() => {
    if (selectedProviders.length === 0) {
      setPolicies([]);
      setLoading(false);
      return;
    }

    const fetchPolicies = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = config.getApiUrl('api/proxy/api/infraweave/api/v1/policies/stable');
        const fetchPromises = selectedProviders.map(() =>
          config.fetch(url).then((response) => {
            if (response.status >= 300 && response.status < 400) {
              throw new Error('Redirected to login or guest page');
            }
            if (!response.ok) throw new Error('Failed to fetch policies');
            return response.json().then((json: any) => json.Items || json.items || json);
          }),
        );

        const results = await Promise.all(fetchPromises);
        setPolicies(results.flat());
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchPolicies();
    const intervalId = setInterval(fetchPolicies, 60000);
    return () => clearInterval(intervalId);
  }, [selectedProviders, config]);

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;

  return <DenseTable policies={policies} />;
};
