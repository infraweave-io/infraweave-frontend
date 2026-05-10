import {
  StatusRunning,
  StatusPending,
  StatusOK,
  StatusWarning,
} from '../../standalone/components/ComponentAdapter';
import React from 'react';

export const StatusSymbol = ({ status }: { status: string }) => {
  switch (status) {
    case 'running':
      return <StatusRunning />;
    case 'pending':
      return <StatusPending />;
    case 'successful':
      return <StatusOK />;
    default:
      return <StatusWarning />;
  }
};
