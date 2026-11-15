import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Fab,
  Fade,
  IconButton,
  InputAdornment,
  keyframes,
  Grow,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PsychologyIcon from '@mui/icons-material/Psychology';
import { useLocation } from 'react-router-dom';
import { useConfig } from '../../hooks/useConfig';
import { ChatMarkdown } from './aiAssistant/ChatMarkdown';
import { streamChat, type ChatEvent, type LlmMessage } from './aiAssistant/chatTransport';

type ChatRole = 'assistant' | 'user';

interface ToolEvent {
  id: string;
  type: 'tool_call' | 'tool_result';
  title: string;
  detail: string;
  isError?: boolean;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  reasoning?: string;
  toolEvents?: ToolEvent[];
  // True while this message's turn is still streaming; cleared once the
  // turn ends (success, error, truncation, or abort) so the render layer
  // knows not to show the "still thinking" placeholder forever.
  pending?: boolean;
}

// Per-turn scratch state for a single sendMessage call. See handleEvent.
interface TurnState {
  historyBuffer: LlmMessage[];
  failed: boolean;
  // Set only by the `done` event. The stream can also end (loop exits
  // without throwing) on a plain EOF that never sent `done` — a proxy or
  // server closing the connection mid-turn. That case must be treated the
  // same as `failed`: an incomplete transcript, never committed.
  done: boolean;
}

const starterPrompts = [
  'What modules are published?',
  'Describe the s3bucketsimple module',
  'Which deployments need attention?',
];

const messageIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const shimmer = keyframes`
  0% {
    background-position: -160px 0;
  }
  100% {
    background-position: 160px 0;
  }
`;

const frameId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const stringifyDetail = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const getInitialTrack = (pathname: string) => {
  const match = pathname.match(/\/infraweave\/(?:module|stack|provider)\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : 'stable';
};

interface PageContext {
  description: string;
  project?: string;
  region?: string;
  environment?: string;
  track?: string;
}

const parsePageContext = (pathname: string): PageContext => {
  const d = (s: string) => decodeURIComponent(s);

  const deployment = pathname.match(
    /^\/infraweave\/deployment\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/,
  );
  if (deployment) {
    const [, project, region, environment, deploymentId, tab] = deployment;
    return {
      description: `Viewing deployment '${d(deploymentId)}' in project '${d(project)}', region '${d(
        region,
      )}', environment '${d(environment)}'${tab ? ` (${d(tab)} tab)` : ''}`,
      project: d(project),
      region: d(region),
      environment: d(environment),
    };
  }

  const module = pathname.match(/^\/infraweave\/module\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (module) {
    const [, track, moduleName, moduleVersion] = module;
    return {
      description: `Viewing module '${d(moduleName)}' version '${d(moduleVersion)}' on track '${d(
        track,
      )}'`,
      track: d(track),
    };
  }

  const stack = pathname.match(/^\/infraweave\/stack\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (stack) {
    const [, track, stackName, stackVersion] = stack;
    return {
      description: `Viewing stack '${d(stackName)}' version '${d(stackVersion)}' on track '${d(
        track,
      )}'`,
      track: d(track),
    };
  }

  const provider = pathname.match(/^\/infraweave\/provider\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (provider) {
    const [, track, providerName, providerVersion] = provider;
    return {
      description: `Viewing provider '${d(providerName)}' version '${d(
        providerVersion,
      )}' on track '${d(track)}'`,
      track: d(track),
    };
  }

  const policy = pathname.match(/^\/infraweave\/policy\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (policy) {
    const [, environment, policyName, policyVersion] = policy;
    return {
      description: `Viewing policy '${d(policyName)}' version '${d(
        policyVersion,
      )}' in environment '${d(environment)}'`,
      environment: d(environment),
    };
  }

  const tabNames: Record<string, string> = {
    overview: 'Overview',
    deployments: 'Deployments',
    stacks: 'Stacks',
    modules: 'Modules',
    providers: 'Providers',
    policies: 'Policies',
    projects: 'Projects',
  };

  // Before the tab match, which the bare dashboard path would otherwise fall into.
  const adoptionHealth = pathname.match(/^\/infraweave\/adoption-health(?:\/([^/]+))?\/?$/);
  if (adoptionHealth) {
    const view = adoptionHealth[1] ? d(adoptionHealth[1]) : 'dashboard';
    return { description: `Viewing Adoption & Health (${view} view)` };
  }

  const tab = pathname.match(/^\/infraweave\/([^/]+)$/);
  if (tab && tabNames[tab[1]]) {
    return { description: `Viewing the ${tabNames[tab[1]]} list` };
  }

  return { description: 'Viewing the InfraWeave dashboard' };
};

export const AiAssistantOverlay: React.FC = () => {
  const config = useConfig();
  const location = useLocation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [track, setTrack] = useState(() => getInitialTrack(location.pathname));
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: frameId(),
      role: 'assistant',
      content:
        'Ask me about modules, deployments, stacks, providers, policies, and the current InfraWeave catalog.',
    },
  ]);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [expandedThinkingMessageId, setExpandedThinkingMessageId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const previousPathRef = useRef(location.pathname);
  // The backend owns the transcript; we store what it sends and replay it verbatim.
  const historyRef = useRef<LlmMessage[]>([]);

  useEffect(() => {
    setTrack(getInitialTrack(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    if (previousPathRef.current !== location.pathname) {
      setOpen(false);
      previousPathRef.current = location.pathname;
    }
  }, [location.pathname]);

  // The location effect above only sees a change of path, so a link that just changes the query
  // (a usage page's filters) has to close the chat itself.
  const closeChat = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, isStreaming]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const assistantActive = useMemo(
    () => messages.some((message) => message.role === 'assistant' && message.content.length > 0),
    [messages],
  );

  const appendToAssistant = (assistantId: string, content: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === assistantId
          ? {
              ...message,
              content: `${message.content}${content}`,
            }
          : message,
      ),
    );
  };

  const addToolEvent = (assistantId: string, event: ToolEvent) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === assistantId
          ? {
              ...message,
              toolEvents: [...(message.toolEvents ?? []), event],
            }
          : message,
      ),
    );
  };

  const appendReasoning = (assistantId: string, chunk: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === assistantId
          ? { ...message, reasoning: `${message.reasoning ?? ''}${chunk}` }
          : message,
      ),
    );
  };

  const markMessageDone = (assistantId: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === assistantId ? { ...message, pending: false } : message,
      ),
    );
  };

  // Scoped to a single sendMessage call. `historyBuffer` accumulates this
  // turn's `history_append` events without touching `historyRef.current`,
  // and `failed` records whether an `error`/`truncated` event ended the
  // turn early. The caller (sendMessage) only folds the buffer into
  // historyRef.current once the turn completes successfully (loop finishes
  // without throwing AND without `failed`); otherwise the buffer is simply
  // discarded so a partial (unbalanced) transcript never gets replayed on
  // the next turn.
  const handleEvent = (assistantId: string, event: ChatEvent, turn: TurnState) => {
    switch (event.type) {
      case 'text':
        appendToAssistant(assistantId, event.text);
        return;
      case 'reasoning':
        appendReasoning(assistantId, event.text);
        return;
      case 'tool_call':
        addToolEvent(assistantId, {
          id: event.id,
          type: 'tool_call',
          title: event.name,
          detail: stringifyDetail(event.input),
        });
        return;
      case 'tool_result':
        addToolEvent(assistantId, {
          id: `${event.id}-result`,
          type: 'tool_result',
          title: event.name,
          detail: event.output_preview,
          isError: event.is_error,
        });
        return;
      case 'history_append':
        turn.historyBuffer.push(event.message);
        return;
      case 'truncated':
        setError(`The assistant stopped early: ${event.reason}`);
        appendToAssistant(assistantId, `\n\nThe assistant stopped early: ${event.reason}`);
        turn.failed = true;
        markMessageDone(assistantId);
        return;
      case 'error':
        setError(event.message);
        appendToAssistant(assistantId, `\n\nI could not reach the assistant: ${event.message}`);
        turn.failed = true;
        markMessageDone(assistantId);
        return;
      case 'usage':
        return;
      case 'done':
        turn.done = true;
        return;
    }
  };

  const sendMessage = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || isStreaming) return;

    const userMessage: ChatMessage = { id: frameId(), role: 'user', content: trimmed };
    const assistantId = frameId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      toolEvents: [],
      pending: true,
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput('');
    setError(null);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const pageContext = parsePageContext(location.pathname);
    // Scoped to this turn: only merged into historyRef.current once the
    // turn finishes without throwing, without an error/truncated event,
    // AND with a `done` event actually observed. A stream that ends (loop
    // exits without throwing) but never sent `done` — e.g. a proxy closing
    // the connection mid-turn — is treated the same as `failed`: the buffer
    // is discarded so historyRef.current never ends up holding an
    // unbalanced or partial transcript that would wedge the next request.
    const turn: TurnState = { historyBuffer: [], failed: false, done: false };

    try {
      for await (const event of streamChat(
        config.fetch,
        config.getApiUrl('api/proxy/api/infraweave/api/v1/chat'),
        {
          message: trimmed,
          history: historyRef.current,
          page_context: pageContext.description,
          ...(pageContext.track || track.trim()
            ? { track: pageContext.track || track.trim() }
            : {}),
          ...(pageContext.project ? { project: pageContext.project } : {}),
          ...(pageContext.region ? { region: pageContext.region } : {}),
          ...(pageContext.environment ? { environment: pageContext.environment } : {}),
        },
        controller.signal,
      )) {
        handleEvent(assistantId, event, turn);
      }
      if (!turn.failed && turn.done) {
        historyRef.current = [...historyRef.current, ...turn.historyBuffer];
      } else if (!turn.failed) {
        // Loop ended without throwing and without an error/truncated event,
        // but `done` never arrived either (e.g. a proxy closed the
        // connection mid-turn). The buffer above is correctly discarded,
        // but the UI otherwise looks like a normal completion — tell the
        // user the turn didn't actually finish, so what they see doesn't
        // silently diverge from what gets replayed next turn.
        const messageText = 'The connection ended before the assistant finished responding.';
        setError(messageText);
        appendToAssistant(assistantId, `\n\n${messageText}`);
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        appendToAssistant(assistantId, '\n\nStopped.');
      } else {
        const messageText = e instanceof Error ? e.message : 'Chat request failed';
        setError(messageText);
        appendToAssistant(assistantId, `I could not reach the assistant: ${messageText}`);
      }
    } finally {
      setIsStreaming(false);
      markMessageDone(assistantId);
      abortRef.current = null;
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    sendMessage(input);
  };

  const panel = (
    <>
      <Fade in={open} mountOnEnter unmountOnExit timeout={{ enter: 180, exit: 140 }}>
        <Box
          onClick={() => setOpen(false)}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: (zTheme) => zTheme.zIndex.modal + 1,
            bgcolor: theme.palette.mode === 'dark' ? alpha('#000', 0.34) : alpha('#0f172a', 0.16),
            backdropFilter: 'blur(3px) saturate(0.96)',
            WebkitBackdropFilter: 'blur(3px) saturate(0.96)',
          }}
        />
      </Fade>
      <Grow
        in={open}
        mountOnEnter
        unmountOnExit
        timeout={{ enter: 300, exit: 210 }}
        style={{ transformOrigin: 'right bottom' }}
      >
        <Paper
          elevation={12}
          sx={{
            position: 'fixed',
            top: fullScreen ? 0 : 88,
            right: fullScreen ? 0 : 28,
            bottom: fullScreen ? 0 : 28,
            left: fullScreen ? 0 : 260,
            width: fullScreen ? '100vw' : 'auto',
            height: fullScreen ? '100dvh' : 'auto',
            maxHeight: fullScreen ? '100dvh' : 'calc(100vh - 116px)',
            zIndex: (zTheme) => zTheme.zIndex.modal + 2,
            overflow: 'hidden',
            borderRadius: fullScreen ? 0 : 2,
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            transformOrigin: 'right bottom',
            transition: 'transform 220ms ease, opacity 220ms ease',
            boxShadow: theme.shadows[16],
          }}
        >
          <Box
            sx={{
              px: 2.25,
              py: 1.25,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'background.paper',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
              }}
            >
              <AutoAwesomeIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
                InfraWeave AI
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Catalog and deployment assistance
              </Typography>
            </Box>
            {isStreaming && <CircularProgress size={18} />}
          </Box>

          <Box
            ref={scrollRef}
            sx={{
              flex: 1,
              overflowY: 'auto',
              px: 2.25,
              py: 2,
              bgcolor: 'background.default',
            }}
          >
            <Stack spacing={1.5}>
              {messages.map((message) => {
                const isUser = message.role === 'user';
                const hasTools = !!message.toolEvents?.length;
                const expanded = expandedMessageId === message.id;
                const answer = message.content;
                const hasThinking = Boolean(message.reasoning);
                const thinkingExpanded = expandedThinkingMessageId === message.id;
                const isIntro =
                  !isUser &&
                  message.content.startsWith(
                    'Ask me about modules, deployments, stacks, providers, policies',
                  );

                return (
                  <Box key={message.id}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: isUser ? 'flex-end' : 'flex-start',
                        animation: `${messageIn} 260ms ease both`,
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: isUser ? '62%' : 'min(960px, 86%)',
                          px: isIntro ? 1.5 : 1.5,
                          py: isIntro ? 1.2 : 1,
                          borderRadius: 1.5,
                          bgcolor: isUser
                            ? 'primary.main'
                            : isIntro
                              ? alpha(
                                  theme.palette.primary.main,
                                  theme.palette.mode === 'dark' ? 0.08 : 0.045,
                                )
                              : 'background.paper',
                          color: isUser ? 'primary.contrastText' : 'text.primary',
                          border: isUser ? 'none' : '1px solid',
                          borderColor: isIntro
                            ? alpha(theme.palette.primary.main, 0.18)
                            : 'divider',
                          boxShadow: 'none',
                          overflowWrap: 'anywhere',
                          transition: 'background-color 180ms ease, border-color 180ms ease',
                          '&:hover': {
                            borderColor: isUser
                              ? 'transparent'
                              : alpha(theme.palette.primary.main, 0.22),
                          },
                        }}
                      >
                        {hasThinking && (
                          <Box sx={{ mb: answer ? 1.25 : 0 }}>
                            <List disablePadding dense>
                              <ListItemButton
                                onClick={() =>
                                  setExpandedThinkingMessageId(thinkingExpanded ? null : message.id)
                                }
                                sx={{
                                  borderRadius: 1,
                                  minHeight: 34,
                                  px: 1,
                                  mb: thinkingExpanded ? 0.75 : 0,
                                  color: 'text.secondary',
                                  bgcolor: alpha(
                                    theme.palette.warning.main,
                                    theme.palette.mode === 'dark' ? 0.1 : 0.06,
                                  ),
                                  '&:hover': {
                                    bgcolor: alpha(
                                      theme.palette.warning.main,
                                      theme.palette.mode === 'dark' ? 0.16 : 0.1,
                                    ),
                                    transform: 'translateX(2px)',
                                  },
                                  transition:
                                    'background-color 180ms ease, transform 180ms ease, color 180ms ease',
                                }}
                              >
                                {thinkingExpanded ? (
                                  <KeyboardArrowDownIcon fontSize="small" />
                                ) : (
                                  <KeyboardArrowRightIcon fontSize="small" />
                                )}
                                <PsychologyIcon
                                  fontSize="small"
                                  sx={{ color: 'warning.main', mr: 1 }}
                                />
                                <ListItemText
                                  primary="Thinking"
                                  primaryTypographyProps={{ variant: 'caption', fontWeight: 700 }}
                                />
                              </ListItemButton>
                            </List>
                            <Collapse in={thinkingExpanded} timeout="auto" unmountOnExit>
                              <Box
                                sx={{
                                  p: 1.25,
                                  borderRadius: 1.25,
                                  bgcolor: alpha(
                                    theme.palette.warning.main,
                                    theme.palette.mode === 'dark' ? 0.12 : 0.08,
                                  ),
                                  border: '1px solid',
                                  borderColor: alpha(theme.palette.warning.main, 0.24),
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: 'text.secondary',
                                    fontStyle: 'italic',
                                    lineHeight: 1.55,
                                    whiteSpace: 'pre-wrap',
                                  }}
                                >
                                  {message.reasoning}
                                </Typography>
                              </Box>
                            </Collapse>
                          </Box>
                        )}
                        {answer ? (
                          <>
                            {isIntro && (
                              <Typography
                                variant="caption"
                                sx={{
                                  color: 'primary.main',
                                  fontWeight: 700,
                                  display: 'block',
                                  mb: 0.5,
                                }}
                              >
                                Ready when you are
                              </Typography>
                            )}
                            <Box
                              sx={{
                                fontSize: '0.95rem',
                                lineHeight: 1.45,
                                '& > :first-child': { mt: 0 },
                                '& > :last-child': { mb: 0 },
                                '& p': { my: 0.75, lineHeight: 1.45 },
                                '& h1': { fontSize: '1.35rem', lineHeight: 1.25, mt: 0, mb: 1 },
                                '& h2': {
                                  fontSize: '1.18rem',
                                  lineHeight: 1.3,
                                  mt: 1.25,
                                  mb: 0.75,
                                },
                                '& h3': { fontSize: '1rem', lineHeight: 1.35, mt: 1, mb: 0.5 },
                                '& h4, & h5, & h6': {
                                  fontSize: '0.95rem',
                                  lineHeight: 1.35,
                                  mt: 1,
                                  mb: 0.5,
                                },
                                '& ul, & ol': { pl: 2.25, my: 0.75 },
                                '& li': { mb: 0.25, lineHeight: 1.4 },
                                '& li > p': { my: 0.25 },
                                '& strong': { fontWeight: 700 },
                                '& a': {
                                  color: 'primary.main',
                                  fontWeight: 600,
                                  textDecoration: 'none',
                                  '&:hover': { textDecoration: 'underline' },
                                },
                                '& blockquote': {
                                  my: 1,
                                  mx: 0,
                                  pl: 1.5,
                                  borderLeft: '3px solid',
                                  borderColor: 'primary.main',
                                  color: 'text.secondary',
                                },
                                '& table': {
                                  display: 'block',
                                  maxWidth: '100%',
                                  overflowX: 'auto',
                                  borderCollapse: 'collapse',
                                  my: 1,
                                },
                                '& th, & td': {
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  px: 1,
                                  py: 0.75,
                                  textAlign: 'left',
                                  verticalAlign: 'top',
                                },
                                '& th': {
                                  bgcolor: alpha(
                                    theme.palette.primary.main,
                                    theme.palette.mode === 'dark' ? 0.14 : 0.08,
                                  ),
                                },
                                '& code': {
                                  px: 0.5,
                                  py: 0.15,
                                  borderRadius: 0.75,
                                  bgcolor: alpha(theme.palette.text.primary, 0.08),
                                  fontSize: '0.88em',
                                  fontFamily: 'monospace',
                                },
                                '& pre': {
                                  p: 1.25,
                                  my: 1,
                                  overflow: 'auto',
                                  borderRadius: 1,
                                  bgcolor: alpha(theme.palette.text.primary, 0.08),
                                },
                                '& pre code': {
                                  p: 0,
                                  bgcolor: 'transparent',
                                  borderRadius: 0,
                                  fontSize: '0.88rem',
                                },
                              }}
                            >
                              <ChatMarkdown onNavigate={closeChat}>{answer}</ChatMarkdown>
                            </Box>
                          </>
                        ) : (
                          !hasThinking &&
                          message.pending && (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <CircularProgress size={16} />
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  backgroundImage: `linear-gradient(90deg, ${theme.palette.text.secondary}, ${theme.palette.primary.main}, ${theme.palette.text.secondary})`,
                                  backgroundSize: '160px 100%',
                                  backgroundClip: 'text',
                                  WebkitBackgroundClip: 'text',
                                  color: 'transparent',
                                  animation: `${shimmer} 1.35s linear infinite`,
                                }}
                              >
                                Thinking through the request...
                              </Typography>
                            </Stack>
                          )
                        )}
                      </Box>
                    </Box>

                    {hasTools && (
                      <Box sx={{ mt: 0.75, maxWidth: 'min(980px, 88%)' }}>
                        <List disablePadding dense>
                          <ListItemButton
                            onClick={() => setExpandedMessageId(expanded ? null : message.id)}
                            sx={{
                              borderRadius: 1,
                              minHeight: 32,
                              px: 1,
                              color: 'text.secondary',
                              transition:
                                'background-color 180ms ease, transform 180ms ease, color 180ms ease',
                              '&:hover': {
                                transform: 'translateX(2px)',
                              },
                            }}
                          >
                            {expanded ? (
                              <KeyboardArrowDownIcon fontSize="small" />
                            ) : (
                              <KeyboardArrowRightIcon fontSize="small" />
                            )}
                            <ListItemText
                              primary={`${message.toolEvents?.length ?? 0} tool event${
                                message.toolEvents?.length === 1 ? '' : 's'
                              }`}
                              primaryTypographyProps={{ variant: 'caption', fontWeight: 600 }}
                            />
                          </ListItemButton>
                        </List>
                        <Collapse in={expanded} timeout="auto" unmountOnExit>
                          <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                            {message.toolEvents?.map((event) => (
                              <Box
                                key={event.id}
                                sx={{
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: 1,
                                  bgcolor: 'background.paper',
                                  p: 1,
                                  animation: `${messageIn} 220ms ease both`,
                                  transition:
                                    'border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
                                  '&:hover': {
                                    borderColor: alpha(theme.palette.primary.main, 0.28),
                                    boxShadow: theme.shadows[1],
                                    transform: 'translateY(-1px)',
                                  },
                                }}
                              >
                                <Chip
                                  size="small"
                                  icon={
                                    event.type === 'tool_call' ? (
                                      <BuildCircleIcon />
                                    ) : (
                                      <CheckCircleIcon />
                                    )
                                  }
                                  label={event.title}
                                  color={
                                    event.isError
                                      ? 'error'
                                      : event.type === 'tool_call'
                                        ? 'info'
                                        : 'success'
                                  }
                                  variant="outlined"
                                  sx={{ mb: 0.75 }}
                                />
                                {event.detail && (
                                  <Typography
                                    component="pre"
                                    variant="caption"
                                    sx={{
                                      m: 0,
                                      whiteSpace: 'pre-wrap',
                                      overflowWrap: 'anywhere',
                                      color: 'text.secondary',
                                      fontFamily: 'monospace',
                                    }}
                                  >
                                    {event.detail}
                                  </Typography>
                                )}
                              </Box>
                            ))}
                          </Stack>
                        </Collapse>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Box>

          <Divider />
          <Box
            sx={{
              p: 1.25,
              pr: fullScreen ? 9.5 : 10,
              bgcolor: 'background.paper',
            }}
          >
            {error && (
              <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            <Stack direction="row" spacing={0.75} sx={{ mb: 1, overflowX: 'auto', pb: 0.25 }}>
              {starterPrompts.map((prompt) => (
                <Chip
                  key={prompt}
                  label={prompt}
                  size="small"
                  clickable
                  onClick={() => setInput(prompt)}
                  disabled={isStreaming}
                  sx={{
                    flexShrink: 0,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.text.primary, 0.04),
                    borderColor: 'divider',
                    transition:
                      'transform 160ms ease, background-color 160ms ease, border-color 160ms ease',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                    },
                  }}
                />
              ))}
            </Stack>
            <Box
              component="form"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                sendMessage(input);
              }}
            >
              <TextField
                placeholder="Ask InfraWeave..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleInputKeyDown}
                disabled={isStreaming}
                fullWidth
                multiline
                minRows={1}
                maxRows={5}
                size="small"
                helperText="Enter to send, Shift+Enter for a new line"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end" sx={{ alignSelf: 'flex-end', mb: 0.5 }}>
                      {isStreaming ? (
                        <Tooltip title="Stop response">
                          <IconButton color="primary" onClick={stopStreaming} edge="end">
                            <StopIcon />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Send message">
                          <span>
                            <IconButton
                              color="primary"
                              type="submit"
                              edge="end"
                              disabled={!input.trim()}
                              sx={{
                                bgcolor: input.trim()
                                  ? alpha(theme.palette.primary.main, 0.1)
                                  : 'transparent',
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.primary.main, 0.16),
                                },
                              }}
                            >
                              <SendIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 1.5,
                    bgcolor:
                      theme.palette.mode === 'dark' ? alpha('#fff', 0.03) : alpha('#0f172a', 0.025),
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'divider',
                    },
                  },
                }}
                FormHelperTextProps={{
                  sx: { mx: 0, mt: 0.5, color: 'text.disabled', fontSize: '0.72rem' },
                }}
              />
            </Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
              <TextField
                label="Track"
                value={track}
                onChange={(event) => setTrack(event.target.value)}
                size="small"
                disabled={isStreaming}
                sx={{
                  width: 128,
                  '& .MuiInputBase-root': { borderRadius: 1.25 },
                }}
              />
              <Box sx={{ flex: 1 }} />
              <Tooltip title="Clear conversation">
                <span>
                  <IconButton
                    size="small"
                    disabled={isStreaming || !assistantActive}
                    onClick={() => {
                      historyRef.current = [];
                      setMessages([
                        {
                          id: frameId(),
                          role: 'assistant',
                          content:
                            'Ask me about modules, deployments, stacks, providers, policies, and the current InfraWeave catalog.',
                        },
                      ]);
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Box>
        </Paper>
      </Grow>
    </>
  );

  return (
    <>
      {panel}
      <Tooltip title={open ? 'Close assistant' : 'Ask InfraWeave AI'}>
        <Fab
          color="primary"
          size="medium"
          aria-label={open ? 'Close assistant' : 'Ask InfraWeave AI'}
          onClick={() => setOpen((current) => !current)}
          sx={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: (zTheme) => zTheme.zIndex.modal + 3,
            // No pulse, no lift, no spin: a control that animates at rest reads
            // as an advertisement for itself.
            boxShadow: theme.shadows[6],
            transition: 'background-color 140ms ease',
            '&:hover': { boxShadow: theme.shadows[8] },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              '& svg': {
                gridArea: '1 / 1',
                fontSize: '1.25rem',
                transition: 'opacity 140ms ease',
              },
            }}
          >
            <AutoAwesomeIcon sx={{ opacity: open ? 0 : 1 }} />
            <CloseIcon sx={{ opacity: open ? 1 : 0 }} />
          </Box>
        </Fab>
      </Tooltip>
    </>
  );
};
