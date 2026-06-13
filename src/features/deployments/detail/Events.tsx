import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useConfig } from '../../../hooks/useConfig';
import {
  Typography,
  Box,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  FormControlLabel,
  FormGroup,
  Checkbox,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import {
  Progress,
  ResponseErrorPanel,
  InfoCard,
  Link,
  Table,
  TableColumn,
} from '../../../standalone/components/ComponentAdapter';
import { ChangeRecord, ResourceChange } from '../../../types/Log';
import { Deployment } from '../../../types/Deployment';
import { Module } from '../../../types/Module';
import { Event } from '../../../types/Event';
import { DrawerContent } from './ReadLogsButton';
import { Drawer } from '@mui/material';
import { CompareVersionsDialog } from '../../modules/detail/CompareVersionsDialog';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';

type JobOutcome = 'successful' | 'failed' | 'in_progress' | 'unknown';

const classifyStatus = (status?: string): JobOutcome => {
  if (!status) return 'unknown';
  const s = status.toLowerCase();
  if (s === 'successful') return 'successful';
  if (s.includes('fail') || s.includes('error')) return 'failed';
  if (
    s === 'requested' ||
    s === 'initiated' ||
    s === 'plan' ||
    s === 'apply' ||
    s === 'waiting-on-dependency'
  )
    return 'in_progress';
  return 'unknown';
};

const JobStatusBadge = ({
  status,
  jobId,
  errorText: errorTextProp,
}: {
  status?: string;
  jobId?: string;
  errorText?: string;
}) => {
  const [errorOpen, setErrorOpen] = useState(false);
  const outcome = classifyStatus(status);
  if (outcome === 'unknown') return null;

  const config: Record<
    Exclude<JobOutcome, 'unknown'>,
    { color: string; label: string; Icon?: typeof CheckCircleIcon }
  > = {
    successful: { color: 'success.main', label: 'Successful', Icon: CheckCircleIcon },
    failed: { color: 'error.main', label: 'Failed', Icon: ErrorIcon },
    in_progress: { color: 'info.main', label: 'In progress', Icon: HourglassEmptyIcon },
  };

  const { color, label, Icon } = config[outcome];
  const tooltip = status && status.toLowerCase() !== outcome ? `${label} (${status})` : label;
  const isClickable = outcome === 'failed' && !!jobId;

  const content = (
    <>
      {outcome === 'in_progress' ? (
        <CircularProgress size={12} sx={{ color: 'inherit' }} />
      ) : (
        Icon && <Icon sx={{ fontSize: 14 }} />
      )}
      <Typography
        component="span"
        variant="caption"
        sx={{
          color: 'inherit',
          fontWeight: 500,
          textDecoration: isClickable ? 'underline' : 'none',
        }}
      >
        {label}
      </Typography>
    </>
  );

  return (
    <>
      <Box
        component={isClickable ? 'button' : 'span'}
        onClick={
          isClickable
            ? (e: React.MouseEvent) => {
                e.stopPropagation();
                setErrorOpen(true);
              }
            : undefined
        }
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          color,
          ...(isClickable
            ? {
                background: 'none',
                border: 'none',
                p: 0,
                cursor: 'pointer',
                font: 'inherit',
                '&:hover': { opacity: 0.8 },
              }
            : {}),
        }}
        title={isClickable ? `${tooltip} — click to view error` : tooltip}
      >
        {content}
      </Box>
      {isClickable && (
        <Dialog
          open={errorOpen}
          onClose={() => setErrorOpen(false)}
          maxWidth="md"
          fullWidth
          onClick={(e) => e.stopPropagation()}
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={1}>
                <ErrorIcon sx={{ color: 'error.main' }} />
                <Typography variant="h6">Job error</Typography>
              </Box>
              <IconButton onClick={() => setErrorOpen(false)} size="small">
                <Close />
              </IconButton>
            </Box>
            {jobId && (
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
              >
                Job: {jobId}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent dividers>
            {errorTextProp?.trim() ? (
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.5,
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  maxHeight: '60vh',
                  overflow: 'auto',
                }}
              >
                {errorTextProp}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No error details available for this job. Open the logs for full output.
              </Typography>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

const summarizeChanges = (changes: ResourceChange[] | undefined) => {
  const summary = { create: 0, update: 0, delete: 0, replace: 0 };
  (changes ?? []).forEach((c) => {
    const action = (c.action || '').toLowerCase();
    if (action in summary) {
      summary[action as keyof typeof summary] += 1;
    }
  });
  return summary;
};

const getChangeTypeColor = (changeType: string): string => {
  switch ((changeType || '').toLowerCase()) {
    case 'apply':
      return 'success.main';
    case 'destroy':
      return 'error.main';
    case 'plan':
      return 'info.main';
    default:
      return 'text.secondary';
  }
};

const getChangeTypeIcon = (changeType: string) => {
  switch ((changeType || '').toLowerCase()) {
    case 'apply':
      return PlayArrowIcon;
    case 'destroy':
      return DeleteOutlineIcon;
    case 'plan':
      return DescriptionOutlinedIcon;
    default:
      return HelpOutlineIcon;
  }
};

const formatTimestamp = (timestamp?: string): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const CompareModuleVersionsButton = ({
  deployment,
  version,
  previousVersion,
}: {
  deployment?: Deployment;
  version: string;
  previousVersion: string;
}) => {
  const config = useConfig();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [module, setModule] = useState<Module | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (module) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const track = deployment?.module_track ?? '';
      const name = deployment?.module ?? '';
      const url = `api/proxy/api/infraweave/api/v1/module/${track}/${encodeURIComponent(
        name,
      )}/${encodeURIComponent(version)}`;
      const response = await config.fetch(config.getApiUrl(url));
      if (!response.ok) {
        throw new Error(`Failed to fetch module: ${response.status}`);
      }
      const json: Module = await response.json();
      setModule(json);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load module');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size="small"
        variant="text"
        startIcon={<CompareArrowsIcon sx={{ fontSize: 16 }} />}
        onClick={handleClick}
        disabled={loading}
        sx={{
          textTransform: 'none',
          fontSize: '0.75rem',
          py: 0,
          px: 0.75,
          minWidth: 0,
          color: 'text.secondary',
        }}
        title={`Compare ${previousVersion} → ${version}`}
      >
        {loading ? 'Loading…' : `${previousVersion} → ${version}`}
      </Button>
      {error && (
        <Typography variant="caption" color="error" sx={{ ml: 1 }}>
          {error}
        </Typography>
      )}
      {module && (
        <CompareVersionsDialog
          open={open}
          onClose={() => setOpen(false)}
          currentModule={module}
          resourceType="module"
          initialCompareVersion={previousVersion}
          initialCompareTrack={deployment?.module_track}
        />
      )}
    </>
  );
};

const serializeVar = (v: any): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
};

const diffVariables = (
  before: Record<string, any>,
  after: Record<string, any>,
): { key: string; type: 'added' | 'removed' | 'changed'; before?: string; after?: string }[] => {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs: {
    key: string;
    type: 'added' | 'removed' | 'changed';
    before?: string;
    after?: string;
  }[] = [];
  keys.forEach((k) => {
    const b = serializeVar(before[k]);
    const a = serializeVar(after[k]);
    if (!(k in before)) diffs.push({ key: k, type: 'added', after: a });
    else if (!(k in after)) diffs.push({ key: k, type: 'removed', before: b });
    else if (b !== a) diffs.push({ key: k, type: 'changed', before: b, after: a });
  });
  return diffs;
};

const CompareManifestButton = ({
  before,
  after,
}: {
  before: Record<string, any>;
  after: Record<string, any>;
}) => {
  const [open, setOpen] = useState(false);
  const diffs = diffVariables(before, after);
  if (diffs.length === 0) return null;

  const colorMap = {
    added: 'success.main',
    removed: 'error.main',
    changed: 'warning.main',
  } as const;

  return (
    <>
      <Button
        size="small"
        variant="text"
        startIcon={<EditOutlinedIcon sx={{ fontSize: 14 }} />}
        onClick={() => setOpen(true)}
        sx={{
          textTransform: 'none',
          fontSize: '0.75rem',
          py: 0,
          px: 0.75,
          minWidth: 0,
          color: 'text.secondary',
        }}
        title="View manifest changes"
      >
        {diffs.length} variable{diffs.length !== 1 ? 's' : ''} changed
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Manifest changes</Typography>
            <IconButton onClick={() => setOpen(false)} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={1}>
            {diffs.map((d) => (
              <Box key={d.key} sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.disabled', display: 'block', mb: 0.25 }}
                >
                  {d.key}
                </Typography>
                {d.type === 'changed' ? (
                  <Box display="flex" flexDirection="column" gap={0.25}>
                    <Box
                      sx={{
                        bgcolor: 'rgba(211,47,47,0.08)',
                        px: 1,
                        py: 0.25,
                        borderRadius: 0.5,
                        color: 'error.main',
                      }}
                    >
                      - {d.before}
                    </Box>
                    <Box
                      sx={{
                        bgcolor: 'rgba(46,125,50,0.08)',
                        px: 1,
                        py: 0.25,
                        borderRadius: 0.5,
                        color: 'success.main',
                      }}
                    >
                      + {d.after}
                    </Box>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      bgcolor: d.type === 'added' ? 'rgba(46,125,50,0.08)' : 'rgba(211,47,47,0.08)',
                      px: 1,
                      py: 0.25,
                      borderRadius: 0.5,
                      color: colorMap[d.type],
                    }}
                  >
                    {d.type === 'added' ? '+' : '-'} {d.type === 'added' ? d.after : d.before}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ChangeSummary = ({
  summary,
}: {
  summary: { create: number; update: number; delete: number; replace: number };
}) => {
  const parts: { label: string; color: string; Icon: typeof AddCircleOutlineIcon }[] = [];
  if (summary.create > 0)
    parts.push({
      label: `${summary.create} created`,
      color: 'success.main',
      Icon: AddCircleOutlineIcon,
    });
  if (summary.update > 0)
    parts.push({
      label: `${summary.update} updated`,
      color: 'warning.main',
      Icon: EditOutlinedIcon,
    });
  if (summary.replace > 0)
    parts.push({ label: `${summary.replace} replaced`, color: '#f9a825', Icon: AutorenewIcon });
  if (summary.delete > 0)
    parts.push({
      label: `${summary.delete} destroyed`,
      color: 'error.main',
      Icon: RemoveCircleOutlineIcon,
    });

  if (parts.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        No resource changes
      </Typography>
    );
  }

  return (
    <Box display="flex" alignItems="center" flexWrap="wrap" sx={{ rowGap: 0.25 }}>
      {parts.map((p, i) => (
        <React.Fragment key={p.label}>
          {i > 0 && (
            <Typography
              component="span"
              variant="caption"
              sx={{ color: 'text.disabled', mx: 0.75 }}
            >
              ·
            </Typography>
          )}
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              color: p.color,
            }}
          >
            <p.Icon sx={{ fontSize: 14 }} />
            <Typography
              component="span"
              variant="caption"
              sx={{ color: 'inherit', fontVariantNumeric: 'tabular-nums' }}
            >
              {p.label}
            </Typography>
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
};

const ChangeRecordActions = ({
  jobId,
  changeType,
  deploymentId,
  deployment,
  jobStatus,
  summary,
}: {
  jobId: string;
  changeType?: string;
  deploymentId?: string;
  deployment?: Deployment;
  jobStatus?: string;
  summary?: { create: number; update: number; delete: number; replace: number };
}) => {
  const [open, setOpen] = useState(false);
  const [viewLogs, setViewLogs] = useState(false);

  const event: Event = {
    deployment_id: deploymentId ?? deployment?.deployment_id ?? '',
    status: jobStatus ?? '',
    event: (changeType ?? '').toLowerCase(),
    module: deployment?.module ?? '',
    job_id: jobId,
    initiated_by: '',
    timestamp: '',
    epoch: 0,
  };

  const openChanges = () => {
    setViewLogs(false);
    setOpen(true);
  };
  const openLogs = () => {
    setViewLogs(true);
    setOpen(true);
  };

  const hasAnyChange = summary
    ? summary.create + summary.update + summary.delete + summary.replace > 0
    : false;

  return (
    <>
      <Box display="flex" alignItems="center" justifyContent="flex-end" gap={1} flexWrap="wrap">
        <Button
          variant="text"
          size="small"
          onClick={openLogs}
          startIcon={<ArticleOutlinedIcon sx={{ fontSize: 14 }} />}
          sx={{
            textTransform: 'none',
            color: 'text.secondary',
            minWidth: 0,
            px: 1,
            py: 0.5,
            fontSize: '0.75rem',
            fontWeight: 500,
            borderRadius: 1,
            '& .MuiButton-startIcon': { mr: 0.5 },
            '&:hover': {
              color: 'primary.main',
              backgroundColor: 'action.hover',
            },
          }}
        >
          Read logs
        </Button>
        {summary !== undefined && (
          <Button
            variant="outlined"
            color="primary"
            onClick={openChanges}
            endIcon={<ChevronRightIcon sx={{ fontSize: 18 }} />}
            sx={{
              textTransform: 'none',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderRadius: 1.5,
              px: 1.5,
              py: 1,
              borderColor: 'divider',
              backgroundColor: 'background.paper',
              transition: 'all 0.15s ease',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'action.hover',
              },
            }}
          >
            <Box
              display="flex"
              flexDirection="column"
              alignItems="flex-start"
              sx={{ minWidth: 0, gap: 0.25 }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontSize: '0.65rem',
                  lineHeight: 1,
                }}
              >
                {hasAnyChange ? 'Changes' : 'No changes'}
              </Typography>
              {hasAnyChange && <ChangeSummary summary={summary} />}
            </Box>
          </Button>
        )}
      </Box>
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
        open={open}
        onClose={() => setOpen(false)}
        sx={{ zIndex: (theme: any) => theme.zIndex.modal + 1 }}
      >
        <DrawerContent
          toggleDrawer={setOpen}
          event={event}
          deployment={deployment}
          viewLogs={viewLogs}
          jobStatus={jobStatus}
        />
      </Drawer>
    </>
  );
};

const renderChangeRecordRow = (cr: ChangeRecord, deployment?: Deployment) => {
  const jobId = cr.job_id ?? '';
  const moduleVersion = cr.module_version;
  const encodedModuleName = encodeURIComponent(deployment?.module ?? '');
  const encodedModuleVersion = encodeURIComponent(moduleVersion ?? '');
  const moduleLink = `/infraweave/${deployment?.module_type}/${deployment?.module_track}/${encodedModuleName}/${encodedModuleVersion}`;
  const summary =
    cr.resource_changes !== undefined ? summarizeChanges(cr.resource_changes) : undefined;
  const changeType = (cr.change_type ?? '').toLowerCase();
  const ChangeTypeIcon = getChangeTypeIcon(changeType);
  const changeTypeColor = getChangeTypeColor(changeType);

  return {
    job: (
      <Box>
        <Box
          display="flex"
          alignItems="center"
          flexWrap="wrap"
          columnGap={1.25}
          rowGap={0.5}
          mb={0.5}
        >
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              color: changeTypeColor,
            }}
          >
            <ChangeTypeIcon sx={{ fontSize: 16 }} />
            <Typography
              variant="overline"
              sx={{
                color: 'inherit',
                fontWeight: 600,
                letterSpacing: '0.06em',
                lineHeight: 1,
              }}
            >
              {changeType || 'unknown'}
            </Typography>
          </Box>
          <Box
            component="button"
            onClick={() => navigator.clipboard.writeText(jobId)}
            title={jobId}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'rgba(237,108,2,0.35)',
              bgcolor: 'rgba(237,108,2,0.1)',
              color: 'warning.dark',
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(237,108,2,0.18)' },
              transition: 'background 0.15s',
            }}
          >
            <ContentCopyIcon sx={{ fontSize: 11, opacity: 0.7 }} />
            {jobId.slice(0, 8)}…
          </Box>
          {moduleVersion && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              <Link to={moduleLink}>{moduleVersion}</Link>
            </Typography>
          )}
          {cr.timestamp && (
            <Typography variant="caption" sx={{ color: 'text.disabled' }} title={cr.timestamp}>
              {formatTimestamp(cr.timestamp)}
            </Typography>
          )}
          <JobStatusBadge status={cr.status} jobId={jobId} errorText={cr.error_text} />
        </Box>
      </Box>
    ),
    logs: jobId ? (
      <ChangeRecordActions
        jobId={jobId}
        changeType={cr.change_type}
        deploymentId={cr.deployment_id}
        deployment={deployment}
        jobStatus={cr.status ?? 'successful'}
        summary={summary}
      />
    ) : (
      <Typography variant="body2" color="text.secondary">
        N/A
      </Typography>
    ),
  };
};

const PAGE_SIZE = 50;
const RECENT_MUTATION_COUNT = 5;

const getChangeRecordSortTime = (record: ChangeRecord): number => {
  if (record.epoch !== undefined) {
    return record.epoch < 10_000_000_000 ? record.epoch * 1000 : record.epoch;
  }
  if (!record.timestamp) return 0;

  const timestamp = new Date(record.timestamp).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const sortChangeRecordsDescending = (records: ChangeRecord[]): ChangeRecord[] =>
  records.slice().sort((a, b) => getChangeRecordSortTime(b) - getChangeRecordSortTime(a));

type EventRecord = Event & {
  change_type?: string;
  error_text?: string;
};

const eventToChangeRecord = (e: EventRecord): ChangeRecord => ({
  timestamp: e.timestamp,
  job_id: e.job_id,
  deployment_id: e.deployment_id,
  change_type: (e.change_type ?? e.event ?? '').toLowerCase(),
  module_version: e.module_version,
  epoch: e.epoch,
  status: e.status,
  error_text: e.error_text,
});

const isMutateChangeType = (changeType?: string) => {
  const ct = (changeType ?? '').toLowerCase();
  return ct === 'apply' || ct === 'destroy';
};

const isPlanChangeType = (changeType?: string) => (changeType ?? '').toLowerCase() === 'plan';

const latestEventPerJob = (events: EventRecord[]): EventRecord[] => {
  const byJob = new Map<string, EventRecord>();
  for (const e of events) {
    if (!e.job_id) continue;
    const cur = byJob.get(e.job_id);
    if (!cur || (e.epoch ?? 0) > (cur.epoch ?? 0)) byJob.set(e.job_id, e);
  }
  return Array.from(byJob.values());
};

const isErrorStatus = (status?: string): boolean => {
  const s = (status ?? '').toLowerCase();
  return s.includes('fail') || s.includes('error');
};

const overlayEventErrors = (records: ChangeRecord[], events: EventRecord[]): ChangeRecord[] => {
  const errorEvents = new Map<string, EventRecord>();
  for (const e of latestEventPerJob(events)) {
    if (e.job_id && isErrorStatus(e.status)) errorEvents.set(e.job_id, e);
  }
  return records.map((cr) => {
    if (!cr.job_id || isErrorStatus(cr.status)) return cr;
    const errEvent = errorEvents.get(cr.job_id);
    if (!errEvent) return cr;
    return {
      ...cr,
      status: errEvent.status,
      error_text: cr.error_text || errEvent.error_text,
    };
  });
};

const buildOrphanEventRecords = (
  records: ChangeRecord[],
  events: EventRecord[],
  filters: { mutate: boolean; plan: boolean },
): ChangeRecord[] => {
  const knownJobs = new Set(records.map((r) => r.job_id).filter(Boolean) as string[]);
  return latestEventPerJob(events)
    .filter((e) => !knownJobs.has(e.job_id))
    .map(eventToChangeRecord)
    .filter((cr) => {
      if (isMutateChangeType(cr.change_type)) return filters.mutate;
      if (isPlanChangeType(cr.change_type)) return filters.plan;
      return filters.mutate || filters.plan;
    });
};

const findScrollableAncestor = (el: HTMLElement | null): HTMLElement | null => {
  let parent = el?.parentElement ?? null;
  while (parent) {
    const style = window.getComputedStyle(parent);
    if (/(auto|scroll|overlay)/.test(style.overflowY)) return parent;
    parent = parent.parentElement;
  }
  return null;
};

export const AllChangeRecords = (
  props: {
    deployment?: Deployment;
    initialFilterMutate?: boolean;
    initialFilterPlan?: boolean;
  } = {
    deployment: undefined,
  },
) => {
  const { deployment, initialFilterMutate = true, initialFilterPlan = false } = props;
  const [filterMutate, setFilterMutate] = useState(initialFilterMutate);
  const [filterPlan, setFilterPlan] = useState(initialFilterPlan);
  const [records, setRecords] = useState<ChangeRecord[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [tokens, setTokens] = useState<{ mutate: string | null; plan: string | null }>({
    mutate: null,
    plan: null,
  });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [reloadKey, setReloadKey] = useState(0);

  const config = useConfig();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchEvents = useCallback(async (): Promise<EventRecord[]> => {
    const project = deployment?.project_id;
    const region = deployment?.region;
    const encodedEnvironment = encodeURIComponent(deployment?.environment ?? '');
    const encodedDeploymentId = encodeURIComponent(deployment?.deployment_id ?? '');
    const url = `api/proxy/api/infraweave/api/v1/events/${project}/${region}/${encodedEnvironment}/${encodedDeploymentId}`;
    const resp = await config.fetch(config.getApiUrl(url)).catch(() => null);
    if (!resp?.ok) return [];
    const json = await resp.json().catch(() => null);
    return Array.isArray(json) ? (json as EventRecord[]) : [];
  }, [
    config,
    deployment?.project_id,
    deployment?.region,
    deployment?.environment,
    deployment?.deployment_id,
  ]);

  const fetchPage = useCallback(
    async (
      changeType: 'mutate' | 'plan',
      nextToken: string | null,
    ): Promise<{ items: ChangeRecord[]; nextToken: string | null }> => {
      const encodedEnvironment = encodeURIComponent(deployment?.environment ?? '');
      const encodedDeploymentId = encodeURIComponent(deployment?.deployment_id ?? '');
      const project = deployment?.project_id;
      const region = deployment?.region;

      // change_records is the primary source — drives pagination and history
      let crUrl = `api/proxy/api/infraweave/api/v1/change_records/${project}/${region}/${encodedEnvironment}/${encodedDeploymentId}?limit=${PAGE_SIZE}&change_type=${changeType}`;
      if (nextToken) crUrl += `&next_token=${encodeURIComponent(nextToken)}`;

      const crResp = await config.fetch(config.getApiUrl(crUrl));

      if (crResp.status >= 300 && crResp.status < 400) {
        throw new Error('Redirected to login or guest page');
      }

      const crItems: ChangeRecord[] = await crResp.json();
      const newNextToken =
        crResp.headers.get('x-next-token') || crResp.headers.get('X-Next-Token') || null;

      const items: ChangeRecord[] = crItems.map((cr): ChangeRecord => {
        return {
          ...cr,
          // resource_changes already in the change_record; use [] if absent but CR exists
          resource_changes: cr.resource_changes ?? [],
        };
      });

      return { items, nextToken: newNextToken };
    },
    // Identity fields only — epoch must NOT be here or the full reload effect fires on completion
    [
      config,
      deployment?.project_id,
      deployment?.region,
      deployment?.environment,
      deployment?.deployment_id,
    ],
  );

  // Silently patch statuses when epoch changes (job completed) without triggering setLoading
  const epochRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const newEpoch = deployment?.epoch;
    if (newEpoch === undefined) return;
    const isMount = epochRef.current === undefined;
    epochRef.current = newEpoch;
    if (isMount) return; // initial mount — main load effect handles this

    const project = deployment?.project_id;
    const region = deployment?.region;
    const encodedEnvironment = encodeURIComponent(deployment?.environment ?? '');
    const encodedDeploymentId = encodeURIComponent(deployment?.deployment_id ?? '');

    const patchStatuses = async () => {
      try {
        const types: ('mutate' | 'plan')[] = [];
        if (filterMutate) types.push('mutate');
        if (filterPlan) types.push('plan');
        const allRecords: ChangeRecord[] = [];
        await Promise.all(
          types.map(async (t) => {
            const url = `api/proxy/api/infraweave/api/v1/change_records/${project}/${region}/${encodedEnvironment}/${encodedDeploymentId}?limit=${PAGE_SIZE}&change_type=${t}`;
            const resp = await config.fetch(config.getApiUrl(url)).catch(() => null);
            if (resp?.ok) {
              const records: ChangeRecord[] = await resp.json();
              allRecords.push(...records);
            }
          }),
        );
        const byJobId = new Map(allRecords.filter((cr) => cr.job_id).map((cr) => [cr.job_id, cr]));
        setRecords((prev) =>
          prev.map((cr) => {
            const fresh = cr.job_id ? byJobId.get(cr.job_id) : undefined;
            if (!fresh) return cr;
            if (fresh.status === cr.status && fresh.error_text === cr.error_text) return cr;
            return { ...cr, status: fresh.status, error_text: fresh.error_text };
          }),
        );
        const freshEvents = await fetchEvents();
        setEvents(freshEvents);
      } catch {
        // Best-effort — silent, never disrupt the UI
      }
    };
    patchStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployment?.epoch]);

  // Initial load (and reload when filters/deployment change)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!filterMutate && !filterPlan) {
        setRecords([]);
        setEvents([]);
        setTokens({ mutate: null, plan: null });
        return;
      }
      setLoading(true);
      setError(undefined);
      try {
        const types: ('mutate' | 'plan')[] = [];
        if (filterMutate) types.push('mutate');
        if (filterPlan) types.push('plan');

        const [results, eventList] = await Promise.all([
          Promise.all(types.map((t) => fetchPage(t, null))),
          fetchEvents(),
        ]);
        if (cancelled) return;

        const merged = sortChangeRecordsDescending(results.flatMap((r) => r.items));
        const newTokens: { mutate: string | null; plan: string | null } = {
          mutate: null,
          plan: null,
        };
        types.forEach((t, i) => {
          newTokens[t] = results[i].nextToken;
        });
        setRecords(merged);
        setEvents(eventList);
        setTokens(newTokens);
      } catch (e) {
        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [filterMutate, filterPlan, fetchPage, fetchEvents, reloadKey]);

  const hasMore = (filterMutate && tokens.mutate !== null) || (filterPlan && tokens.plan !== null);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const calls: Promise<{
        type: 'mutate' | 'plan';
        items: ChangeRecord[];
        nextToken: string | null;
      }>[] = [];
      if (filterMutate && tokens.mutate) {
        calls.push(
          fetchPage('mutate', tokens.mutate).then((r) => ({ type: 'mutate' as const, ...r })),
        );
      }
      if (filterPlan && tokens.plan) {
        calls.push(fetchPage('plan', tokens.plan).then((r) => ({ type: 'plan' as const, ...r })));
      }
      const results = await Promise.all(calls);

      setRecords((prev) => {
        const combined = [...prev, ...results.flatMap((r) => r.items)];
        return sortChangeRecordsDescending(combined);
      });
      setTokens((prev) => {
        const next = { ...prev };
        results.forEach((r) => {
          next[r.type] = r.nextToken;
        });
        return next;
      });
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, hasMore, filterMutate, filterPlan, tokens, fetchPage]);

  // Infinite scroll: trigger loadMore when sentinel is near the bottom of its scrollable ancestor
  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const scrollContainer = findScrollableAncestor(sentinel);

    const check = () => {
      if (!sentinelRef.current) return;
      const rect = sentinelRef.current.getBoundingClientRect();
      const threshold = 400;
      const containerBottom = scrollContainer
        ? scrollContainer.getBoundingClientRect().bottom
        : window.innerHeight;
      if (rect.top <= containerBottom + threshold) {
        loadMore();
      }
    };

    const target: EventTarget = scrollContainer ?? window;
    target.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    // Run once in case content fits without scrolling
    check();

    return () => {
      target.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [hasMore, loadMore, records.length]);

  if (loading && records.length === 0) {
    return <Progress />;
  } else if (error && records.length === 0) {
    return <ResponseErrorPanel error={error} />;
  }

  const columns: TableColumn[] = [
    { title: 'Job', field: 'job', width: '70%' },
    { title: '', field: 'logs', width: '30%' },
  ];

  const recordsWithEventErrors = overlayEventErrors(records, events);
  const orphanEvents = buildOrphanEventRecords(recordsWithEventErrors, events, {
    mutate: filterMutate,
    plan: filterPlan,
  });
  const sortedRecords = sortChangeRecordsDescending([...recordsWithEventErrors, ...orphanEvents]);

  const data: any[] = [];
  sortedRecords.forEach((cr, i) => {
    data.push(renderChangeRecordRow(cr, deployment));
    const next = sortedRecords[i + 1];
    if (next) {
      const versionDiffers =
        cr.module_version && next.module_version && cr.module_version !== next.module_version;
      const varsBefore = next.variables ?? {};
      const varsAfter = cr.variables ?? {};
      const varsDiffer = diffVariables(varsBefore, varsAfter).length > 0;
      if (versionDiffers || varsDiffer) {
        data.push({
          _divider: (
            <Box display="flex" alignItems="center" justifyContent="center" gap={1.5}>
              <Box sx={{ width: 80, borderTop: '1px dashed', borderColor: 'divider' }} />
              {versionDiffers && (
                <CompareModuleVersionsButton
                  deployment={deployment}
                  version={cr.module_version!}
                  previousVersion={next.module_version!}
                />
              )}
              {varsDiffer && <CompareManifestButton before={varsBefore} after={varsAfter} />}
              <Box sx={{ width: 80, borderTop: '1px dashed', borderColor: 'divider' }} />
            </Box>
          ),
        });
      }
    }
  });

  const handleFilterChange = (type: 'mutate' | 'plan', checked: boolean) => {
    if (type === 'mutate') setFilterMutate(checked);
    else setFilterPlan(checked);
    // Reload from scratch on filter change
    setReloadKey((k) => k + 1);
  };

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Box display="flex" justifyContent="flex-end">
        <FormGroup row>
          <FormControlLabel
            control={
              <Checkbox
                checked={filterMutate}
                onChange={(e) => handleFilterChange('mutate', e.target.checked)}
                size="small"
              />
            }
            label="Mutate (Apply/Destroy)"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={filterPlan}
                onChange={(e) => handleFilterChange('plan', e.target.checked)}
                size="small"
              />
            }
            label="Plan"
          />
        </FormGroup>
      </Box>
      <Table
        title="Change records for this deployment"
        options={{
          search: true,
          paging: false,
          draggable: true,
          columnResizable: true,
        }}
        columns={columns}
        data={data}
      />
      <Box ref={sentinelRef} display="flex" justifyContent="center" py={2}>
        {loadingMore ? (
          <Progress />
        ) : hasMore ? (
          <Typography variant="caption" color="text.secondary">
            Scroll to load more
          </Typography>
        ) : records.length > 0 ? (
          <Typography variant="caption" color="text.disabled">
            End of results
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
};

export const RecentEvents = (
  props: { deployment?: Deployment } = {
    deployment: undefined,
  },
) => {
  const { deployment } = props;
  const [openEventsModal, setOpenEventsModal] = useState(false);
  const [modalFilters, setModalFilters] = useState<{ mutate: boolean; plan: boolean }>({
    mutate: true,
    plan: false,
  });

  const config = useConfig();
  const [changeRecords, setChangeRecords] = useState<ChangeRecord[]>([]);
  const [recentEvents, setRecentEvents] = useState<EventRecord[]>([]);
  const [rcLoading, setRcLoading] = useState(true);
  const [rcError, setRcError] = useState<Error | undefined>(undefined);

  const fetchRecentMutations = useCallback(async (): Promise<ChangeRecord[]> => {
    const project = deployment?.project_id;
    const region = deployment?.region;
    const encodedEnvironment = encodeURIComponent(deployment?.environment ?? '');
    const encodedDeploymentId = encodeURIComponent(deployment?.deployment_id ?? '');

    const url = `api/proxy/api/infraweave/api/v1/change_records/${project}/${region}/${encodedEnvironment}/${encodedDeploymentId}?limit=${PAGE_SIZE}&change_type=mutate`;
    const response = await config.fetch(config.getApiUrl(url));
    if (response.status >= 300 && response.status < 400) {
      throw new Error('Redirected to login or guest page');
    }

    const records: ChangeRecord[] = await response.json();
    return sortChangeRecordsDescending(records).slice(0, RECENT_MUTATION_COUNT);
  }, [
    config,
    deployment?.project_id,
    deployment?.region,
    deployment?.environment,
    deployment?.deployment_id,
  ]);

  const fetchRecentEvents = useCallback(async (): Promise<EventRecord[]> => {
    const project = deployment?.project_id;
    const region = deployment?.region;
    const encodedEnvironment = encodeURIComponent(deployment?.environment ?? '');
    const encodedDeploymentId = encodeURIComponent(deployment?.deployment_id ?? '');
    const url = `api/proxy/api/infraweave/api/v1/events/${project}/${region}/${encodedEnvironment}/${encodedDeploymentId}`;
    const resp = await config.fetch(config.getApiUrl(url)).catch(() => null);
    if (!resp?.ok) return [];
    const json = await resp.json().catch(() => null);
    return Array.isArray(json) ? (json as EventRecord[]) : [];
  }, [
    config,
    deployment?.project_id,
    deployment?.region,
    deployment?.environment,
    deployment?.deployment_id,
  ]);

  // Initial load: fetch recent mutate change records and events
  useEffect(() => {
    if (!deployment?.project_id) return;
    let cancelled = false;

    const load = async () => {
      setRcLoading(true);
      try {
        const [records, events] = await Promise.all([fetchRecentMutations(), fetchRecentEvents()]);
        if (!cancelled) {
          setChangeRecords(records);
          setRecentEvents(events);
          setRcError(undefined);
        }
      } catch (e) {
        if (!cancelled) setRcError(e as Error);
      } finally {
        if (!cancelled) setRcLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [deployment?.project_id, fetchRecentMutations, fetchRecentEvents]);

  // Silently patch statuses when epoch changes — no spinner, no modal disruption
  const recentEpochRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const newEpoch = deployment?.epoch;
    if (newEpoch === undefined) return;
    const isMount = recentEpochRef.current === undefined;
    recentEpochRef.current = newEpoch;
    if (isMount || !deployment?.project_id) return;

    const refreshRecent = async () => {
      try {
        const [records, events] = await Promise.all([fetchRecentMutations(), fetchRecentEvents()]);
        setChangeRecords(records);
        setRecentEvents(events);
      } catch {
        /* best-effort */
      }
    };
    refreshRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployment?.epoch]);

  if (rcLoading) {
    return <Progress />;
  } else if (rcError) {
    return <ResponseErrorPanel error={rcError} />;
  }

  const columns: TableColumn[] = [
    { title: 'Job', field: 'job', width: '70%' },
    { title: '', field: 'logs', width: '30%' },
  ];

  const changeRecordsWithEventErrors = overlayEventErrors(changeRecords, recentEvents);
  const recentOrphans = buildOrphanEventRecords(changeRecordsWithEventErrors, recentEvents, {
    mutate: true,
    plan: false,
  });
  const recentDisplay = sortChangeRecordsDescending([
    ...changeRecordsWithEventErrors,
    ...recentOrphans,
  ]).slice(0, RECENT_MUTATION_COUNT);

  const data: any[] = [];
  recentDisplay.forEach((cr, i) => {
    data.push(renderChangeRecordRow(cr, deployment));
    const next = recentDisplay[i + 1];
    if (next) {
      const versionDiffers =
        cr.module_version && next.module_version && cr.module_version !== next.module_version;
      const varsBefore = next.variables ?? {};
      const varsAfter = cr.variables ?? {};
      const varsDiffer = diffVariables(varsBefore, varsAfter).length > 0;
      if (versionDiffers || varsDiffer) {
        data.push({
          _divider: (
            <Box display="flex" alignItems="center" justifyContent="center" gap={1.5}>
              <Box sx={{ width: 80, borderTop: '1px dashed', borderColor: 'divider' }} />
              {versionDiffers && (
                <CompareModuleVersionsButton
                  deployment={deployment}
                  version={cr.module_version!}
                  previousVersion={next.module_version!}
                />
              )}
              {varsDiffer && <CompareManifestButton before={varsBefore} after={varsAfter} />}
              <Box sx={{ width: 80, borderTop: '1px dashed', borderColor: 'divider' }} />
            </Box>
          ),
        });
      }
    }
  });

  return (
    <>
      <InfoCard
        title={
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <span>5 Most Recent Mutations</span>
            <Box display="flex" gap={1}>
              <Button
                size="small"
                onClick={() => {
                  setModalFilters({ mutate: false, plan: true });
                  setOpenEventsModal(true);
                }}
              >
                Show Plans
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setModalFilters({ mutate: true, plan: false });
                  setOpenEventsModal(true);
                }}
              >
                Show All
              </Button>
            </Box>
          </Box>
        }
      >
        <Table
          options={{
            search: false,
            paging: false,
            draggable: false,
          }}
          columns={columns}
          data={data}
        />
      </InfoCard>
      <Dialog
        open={openEventsModal}
        onClose={() => setOpenEventsModal(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">All Change Records</Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={() => setOpenEventsModal(false)}
              aria-label="close"
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <AllChangeRecords
            deployment={deployment}
            initialFilterMutate={modalFilters.mutate}
            initialFilterPlan={modalFilters.plan}
            key={`${modalFilters.mutate}-${modalFilters.plan}`} // Force re-render when filters change
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
