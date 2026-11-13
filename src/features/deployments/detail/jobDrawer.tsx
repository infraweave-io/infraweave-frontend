import React, { useCallback, useMemo, useRef } from 'react';
import { Drawer } from '@mui/material';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Deployment } from '../../../types/Deployment';
import { Event } from '../../../types/Event';
import { LogViewerState } from '../../../standalone/components/ComponentAdapter';
import { DrawerContent } from './ReadLogsButton';

/**
 * The job whose logs or changes the deployment page has open, kept in the URL so a link can open
 * the drawer directly, e.g. `?job=abc123&view=logs&type=mutate`. The log viewer's search, mode,
 * word wrap, match and selected line ride along, e.g. `&q=plan:&mode=highlight&wrap=1&match=3`
 * or `&line=120`, so the link opens the logs exactly as they were.
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
const LOG_KEYS = ['q', 'mode', 'wrap', 'match', 'line'] as const;

const positiveInt = (value: string | null): number | undefined => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export const readLogViewState = (params: URLSearchParams): Partial<LogViewerState> => {
  const state: Partial<LogViewerState> = {};
  const search = params.get('q');
  if (search) state.search = search;
  if (params.get('mode') === 'highlight') state.filter = false;
  if (params.get('wrap') === '1') state.wrap = true;
  const match = positiveInt(params.get('match'));
  if (match) state.match = match - 1;
  const line = positiveInt(params.get('line'));
  if (line) state.line = line;
  return state;
};

/** Defaults (filter mode, no wrap, first match) are left out to keep links short. */
export const writeLogViewState = (
  current: URLSearchParams,
  state: LogViewerState,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  LOG_KEYS.forEach((key) => next.delete(key));
  if (state.search) next.set('q', state.search);
  if (!state.filter) next.set('mode', 'highlight');
  if (state.wrap) next.set('wrap', '1');
  if (state.match > 0) next.set('match', String(state.match + 1));
  if (state.line !== undefined) next.set('line', String(state.line));
  return next;
};

const isJobView = (value: string | null): value is JobView =>
  value === 'logs' || value === 'changes';

/** `current` is kept so opening a job doesn't drop the rest of the page's query. */
export const jobDrawerSearch = (current: URLSearchParams, target: JobDrawerTarget): string => {
  const next = new URLSearchParams(current);
  // Log settings belong to the job they were made on.
  LOG_KEYS.forEach((key) => next.delete(key));
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
          LOG_KEYS.forEach((key) => next.delete(key));
          return next;
        },
        // Only links add a history entry.
        { replace: true },
      ),
    [setParams],
  );

  // Carried along so the job status a link passed survives the viewer rewriting the URL.
  const routerState = useLocation().state;
  const setLogViewState = useCallback(
    (state: LogViewerState) =>
      setParams((current) => writeLogViewState(current, state), {
        replace: true,
        state: routerState,
      }),
    [setParams, routerState],
  );

  return { target, close, logViewState: readLogViewState(params), setLogViewState };
};

export const JobDrawer = ({ deployment }: { deployment?: Deployment }) => {
  const { target, close, logViewState, setLogViewState } = useJobDrawer();
  const location = useLocation();
  const jobStatus = (location.state as JobDrawerState)?.jobStatus;

  // Keep showing the last job while the drawer slides closed.
  const last = useRef<{ target: JobDrawerTarget; jobStatus?: string } | null>(null);
  if (target) last.current = { target, jobStatus };
  const shown = last.current;

  // Kept stable across renders: the logs and changes refetch whenever the event changes, and the
  // log viewer's search rewrites the URL, which re-renders the drawer.
  const deploymentId = deployment?.deployment_id ?? '';
  const module = deployment?.module ?? '';
  const jobId = shown?.target.jobId;
  const changeType = shown?.target.changeType ?? '';
  const shownStatus = shown?.jobStatus ?? '';
  const event = useMemo<Event | undefined>(
    () =>
      jobId
        ? {
            deployment_id: deploymentId,
            status: shownStatus,
            event: changeType,
            module,
            job_id: jobId,
            initiated_by: '',
            timestamp: '',
            epoch: 0,
          }
        : undefined,
    [deploymentId, module, jobId, changeType, shownStatus],
  );

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
          // A fresh viewer per job, so one job's search doesn't carry over to the next. The
          // deployment's scope is included because the requests use it but the event doesn't.
          key={[
            deployment?.project_id,
            deployment?.region,
            deployment?.environment,
            deploymentId,
            shown.target.jobId,
            shown.target.view,
          ].join(':')}
          toggleDrawer={(isOpen) => !isOpen && close()}
          event={event}
          deployment={deployment}
          viewLogs={shown.target.view === 'logs'}
          jobStatus={shown.jobStatus}
          logView={{ initialState: logViewState, onStateChange: setLogViewState }}
        />
      )}
    </Drawer>
  );
};
