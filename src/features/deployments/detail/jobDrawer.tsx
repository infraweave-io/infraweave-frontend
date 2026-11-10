import React, { useCallback, useRef } from 'react';
import { Drawer } from '@mui/material';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Deployment } from '../../../types/Deployment';
import { Event } from '../../../types/Event';
import { DrawerContent } from './ReadLogsButton';

/**
 * The job whose logs or changes the deployment page has open, kept in the URL so a link can open
 * the drawer directly, e.g. `?job=abc123&view=logs&type=mutate`.
 */

export type JobView = 'logs' | 'changes';

export type JobDrawerTarget = {
  jobId: string;
  view: JobView;
  /** The change record type (mutate, plan, ...). Changes can't be fetched without it. */
  changeType?: string;
};

/** Passed as router state by in-app links, so the status chip shows without a refetch. */
type JobDrawerState = { jobStatus?: string } | null;

const JOB_KEY = 'job';
const VIEW_KEY = 'view';
const TYPE_KEY = 'type';

const isJobView = (value: string | null): value is JobView =>
  value === 'logs' || value === 'changes';

/** `current` is kept so opening a job doesn't drop the rest of the page's query. */
export const jobDrawerSearch = (current: URLSearchParams, target: JobDrawerTarget): string => {
  const next = new URLSearchParams(current);
  next.set(JOB_KEY, target.jobId);
  next.set(VIEW_KEY, target.view);
  if (target.changeType) next.set(TYPE_KEY, target.changeType.toLowerCase());
  else next.delete(TYPE_KEY);
  return `?${next.toString()}`;
};

export const useJobDrawer = () => {
  const [params, setParams] = useSearchParams();
  const jobId = params.get(JOB_KEY);
  const view = params.get(VIEW_KEY);
  const target: JobDrawerTarget | undefined =
    jobId && isJobView(view)
      ? { jobId, view, changeType: params.get(TYPE_KEY) ?? undefined }
      : undefined;

  const close = useCallback(
    () =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete(JOB_KEY);
          next.delete(VIEW_KEY);
          next.delete(TYPE_KEY);
          return next;
        },
        // Only links add a history entry.
        { replace: true },
      ),
    [setParams],
  );

  return { target, close };
};

export const JobDrawer = ({ deployment }: { deployment?: Deployment }) => {
  const { target, close } = useJobDrawer();
  const location = useLocation();
  const jobStatus = (location.state as JobDrawerState)?.jobStatus;

  // Keep showing the last job while the drawer slides closed.
  const last = useRef<{ target: JobDrawerTarget; jobStatus?: string } | null>(null);
  if (target) last.current = { target, jobStatus };
  const shown = last.current;

  const event: Event | undefined = shown
    ? {
        deployment_id: deployment?.deployment_id ?? '',
        status: shown.jobStatus ?? '',
        event: shown.target.changeType ?? '',
        module: deployment?.module ?? '',
        job_id: shown.target.jobId,
        initiated_by: '',
        timestamp: '',
        epoch: 0,
      }
    : undefined;

  return (
    <Drawer
      PaperProps={{
        sx: {
          width: '70%',
          display: 'flex',
          flexDirection: 'column',
          p: 2.5,
          pt: 10,
          height: '100vh',
          overflow: 'hidden',
        },
      }}
      anchor="right"
      open={!!target}
      onClose={close}
      disableEnforceFocus
      sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
    >
      {shown && (
        <DrawerContent
          toggleDrawer={(isOpen) => !isOpen && close()}
          event={event}
          deployment={deployment}
          viewLogs={shown.target.view === 'logs'}
          jobStatus={shown.jobStatus}
        />
      )}
    </Drawer>
  );
};
