import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocation } from 'react-router-dom';
import { useConfig } from '../../hooks/useConfig';

type ChatRole = 'assistant' | 'user';

interface ToolEvent {
  id: string;
  type: 'tool_call' | 'tool_result';
  title: string;
  detail: string;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  toolEvents?: ToolEvent[];
}

interface SseFrame {
  event?: string;
  data: string;
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

const softPulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.32);
  }
  70% {
    box-shadow: 0 0 0 16px rgba(99, 102, 241, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
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

const readSseFrames = (chunk: string, pending: string): { frames: SseFrame[]; pending: string } => {
  const text = pending + chunk;
  const blocks = text.split(/\r?\n\r?\n/);
  const nextPending = blocks.pop() ?? '';

  return {
    pending: nextPending,
    frames: blocks
      .map((block) => {
        const lines = block.split(/\r?\n/);
        const eventLine = lines.find((line) => line.startsWith('event:'));
        const data = lines
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');

        return {
          event: eventLine?.slice(6).trim(),
          data,
        };
      })
      .filter((frame) => frame.event || frame.data),
  };
};

const stringifyDetail = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const pickText = (value: any): string => {
  if (typeof value === 'string') return value;
  return (
    value?.text ??
    value?.message ??
    value?.content ??
    value?.delta ??
    value?.answer ??
    stringifyDetail(value)
  );
};

const parseFrame = (frame: SseFrame) => {
  let payload: any = frame.data;

  try {
    payload = JSON.parse(frame.data);
  } catch {
    // Plain text SSE frames are valid for streamed model output.
  }

  const type =
    frame.event || (typeof payload === 'object' ? payload.type || payload.event : 'text');
  return { type, payload };
};

const toolTitle = (payload: any, fallback: string) =>
  payload?.name || payload?.tool_name || payload?.tool || payload?.function?.name || fallback;

const getInitialTrack = (pathname: string) => {
  const match = pathname.match(/\/infraweave\/(?:module|stack|provider)\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : 'stable';
};

const splitThinking = (content: string) => {
  const thinking: string[] = [];
  let answer = '';
  let cursor = 0;
  const tagRegex = /<thinking>([\s\S]*?)<\/thinking>/gi;
  let match = tagRegex.exec(content);

  while (match) {
    answer += content.slice(cursor, match.index);
    thinking.push(match[1].trim());
    cursor = match.index + match[0].length;
    match = tagRegex.exec(content);
  }

  const tail = content.slice(cursor);
  const openThinkingIndex = tail.toLowerCase().indexOf('<thinking>');

  if (openThinkingIndex >= 0) {
    answer += tail.slice(0, openThinkingIndex);
    thinking.push(tail.slice(openThinkingIndex + '<thinking>'.length).trim());
  } else {
    answer += tail;
  }

  return {
    answer: answer.replace(/<\/?thinking>/gi, '').trim(),
    thinking: thinking.filter(Boolean),
  };
};

const buildChatHistory = (messages: ChatMessage[]) =>
  messages
    .filter((message) => {
      if (!message.content.trim()) return false;
      return !message.content.startsWith(
        'Ask me about modules, deployments, stacks, providers, policies',
      );
    })
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content:
        message.role === 'assistant'
          ? splitThinking(message.content).answer || message.content
          : message.content,
    }));

const buildContextualMessage = (message: string, history: ReturnType<typeof buildChatHistory>) => {
  if (!history.length) return message;

  const transcript = history
    .map(({ role, content }) => `${role === 'user' ? 'User' : 'Assistant'}: ${content}`)
    .join('\n\n');

  return `Use this previous conversation for context:\n\n${transcript}\n\nCurrent user message: ${message}`;
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

  useEffect(() => {
    setTrack(getInitialTrack(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    if (previousPathRef.current !== location.pathname) {
      setOpen(false);
      previousPathRef.current = location.pathname;
    }
  }, [location.pathname]);

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

  const handleFrame = (assistantId: string, frame: SseFrame) => {
    const { type, payload } = parseFrame(frame);

    if (type === 'done') return;

    if (type === 'text' || type === 'message' || type === 'delta') {
      appendToAssistant(assistantId, pickText(payload));
      return;
    }

    if (type === 'tool_call' || type === 'tool_result') {
      addToolEvent(assistantId, {
        id: frameId(),
        type,
        title: toolTitle(payload, type === 'tool_call' ? 'Tool call' : 'Tool result'),
        detail: stringifyDetail(payload?.arguments ?? payload?.args ?? payload?.result ?? payload),
      });
      return;
    }

    if (typeof payload === 'string') {
      appendToAssistant(assistantId, payload);
      return;
    }

    if (payload?.text || payload?.content || payload?.message) {
      appendToAssistant(assistantId, pickText(payload));
    }
  };

  const sendMessage = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || isStreaming) return;

    const history = buildChatHistory(messages);
    const userMessage: ChatMessage = { id: frameId(), role: 'user', content: trimmed };
    const assistantId = frameId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      toolEvents: [],
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput('');
    setError(null);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await config.fetch(
        config.getApiUrl('api/proxy/api/infraweave/api/v1/chat'),
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: buildContextualMessage(trimmed, history),
            ...(track.trim() ? { track: track.trim() } : {}),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Chat request failed with ${response.status}`);
      }

      if (!response.body) {
        appendToAssistant(assistantId, await response.text());
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const decoded = decoder.decode(value, { stream: true });
        const parsed = readSseFrames(decoded, pending);
        pending = parsed.pending;
        parsed.frames.forEach((frame) => handleFrame(assistantId, frame));
      }

      const tail = decoder.decode();
      const parsedTail = readSseFrames(tail, pending);
      parsedTail.frames.forEach((frame) => handleFrame(assistantId, frame));

      if (parsedTail.pending.trim()) {
        appendToAssistant(assistantId, parsedTail.pending.trim());
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
            transition:
              'box-shadow 220ms ease, border-color 220ms ease, transform 220ms ease, opacity 220ms ease',
            boxShadow:
              theme.palette.mode === 'dark'
                ? `0 20px 60px ${alpha('#000', 0.48)}`
                : `0 20px 60px ${alpha('#0f172a', 0.12)}`,
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
                transition: 'transform 180ms ease, background-color 180ms ease',
                '&:hover': {
                  transform: 'scale(1.03)',
                  bgcolor: alpha(theme.palette.primary.main, 0.14),
                },
              }}
            >
              <AutoAwesomeIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
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
              bgcolor: theme.palette.mode === 'dark' ? alpha('#000', 0.12) : '#fbfcfe',
            }}
          >
            <Stack spacing={1.5}>
              {messages.map((message) => {
                const isUser = message.role === 'user';
                const hasTools = !!message.toolEvents?.length;
                const expanded = expandedMessageId === message.id;
                const { answer, thinking } = splitThinking(message.content);
                const hasThinking = thinking.length > 0;
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
                              <Stack spacing={0.75}>
                                {thinking.map((thought, index) => (
                                  <Box
                                    key={`${message.id}-thinking-${index}`}
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
                                      }}
                                    >
                                      {thought}
                                    </Typography>
                                  </Box>
                                ))}
                              </Stack>
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
                              <ReactMarkdown remarkPlugins={[remarkGfm] as any}>
                                {answer}
                              </ReactMarkdown>
                            </Box>
                          </>
                        ) : (
                          !thinking.length && (
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
                                  color={event.type === 'tool_call' ? 'info' : 'success'}
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
                    onClick={() =>
                      setMessages([
                        {
                          id: frameId(),
                          role: 'assistant',
                          content:
                            'Ask me about modules, deployments, stacks, providers, policies, and the current InfraWeave catalog.',
                        },
                      ])
                    }
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
          onClick={() => setOpen((current) => !current)}
          sx={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: (zTheme) => zTheme.zIndex.modal + 3,
            boxShadow: `0 16px 36px ${alpha(theme.palette.primary.main, 0.34)}`,
            animation: open ? 'none' : `${softPulse} 2.4s ease-out infinite`,
            transition: 'transform 200ms ease, box-shadow 200ms ease, background-color 200ms ease',
            transform: open ? 'rotate(90deg) scale(1.02)' : 'rotate(0deg) scale(1)',
            '&:hover': {
              transform: open
                ? 'rotate(90deg) translateY(-2px) scale(1.06)'
                : 'translateY(-2px) scale(1.04)',
              boxShadow: `0 20px 44px ${alpha(theme.palette.primary.main, 0.42)}`,
              animation: 'none',
            },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              '& svg': {
                gridArea: '1 / 1',
                transition: 'opacity 160ms ease, transform 200ms ease',
              },
            }}
          >
            <AutoAwesomeIcon
              sx={{
                opacity: open ? 0 : 1,
                transform: open ? 'scale(0.6) rotate(-45deg)' : 'scale(1) rotate(0deg)',
              }}
            />
            <CloseIcon
              sx={{
                opacity: open ? 1 : 0,
                transform: open ? 'scale(1) rotate(-90deg)' : 'scale(0.6) rotate(-45deg)',
              }}
            />
          </Box>
        </Fab>
      </Tooltip>
    </>
  );
};
