import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useConfig } from '../../../hooks/useConfig';
import {
  Progress,
  ResponseErrorPanel,
  LogViewer,
} from '../../../standalone/components/ComponentAdapter';
import { Log } from '../../../types/Log';
import { Event } from '../../../types/Event';
import { Deployment } from '../../../types/Deployment';
import { useAsync } from '../../../hooks/useAsync';

const POLL_INTERVAL_MS = 5000;
const INITIAL_FETCH_PAGE_LIMIT = 50;

export const Logs = (
  props: { event?: Event; deployment?: Deployment } = {
    event: undefined,
  },
) => {
  const { event, deployment } = props;

  const encodedJobId = encodeURIComponent(event?.job_id ?? '');
  const project = deployment?.project_id;
  const region = deployment?.region;

  // State to hold the logs
  const [logs, setLogs] = useState<string | null>(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [error, _setError] = useState<Error | null>(null);
  const [_isLoadingMore, setIsLoadingMore] = useState(false);
  const logsRef = useRef('');
  const nextForwardTokenRef = useRef<string | undefined>(undefined);
  const lastLogChunkRef = useRef('');

  const updateLogs = useCallback((value: string) => {
    logsRef.current = value;
    setLogs(value);
  }, []);

  const appendLogs = useCallback((chunk: string) => {
    if (!chunk) return;

    setLogs((prevLogs) => {
      const currentLogs = prevLogs || '';
      const nextLogs = currentLogs.endsWith(chunk) ? currentLogs : currentLogs + chunk;
      logsRef.current = nextLogs;
      return nextLogs;
    });
    lastLogChunkRef.current = chunk;
  }, []);

  const updateNextForwardToken = useCallback((token: string | undefined) => {
    nextForwardTokenRef.current = token;
  }, []);

  // Helper to truncate logs for debug output
  const truncateLogs = (logText: string, maxLength: number = 100): string => {
    if (!logText) return '(empty)';
    if (logText.length <= maxLength) return logText;
    return `${logText.substring(0, maxLength)}... [truncated, total length: ${logText.length}]`;
  };

  // Function to fetch logs with pagination support
  const config = useConfig();
  const fetchLogs = useCallback(
    async (token?: string): Promise<Log> => {
      console.log('[LOGS] 🔄 Fetching logs:', {
        hasToken: !!token,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'none',
        tokenType: token?.startsWith('b/')
          ? 'backward'
          : token?.startsWith('f/')
            ? 'forward'
            : 'unknown',
      });

      try {
        const params = new URLSearchParams({ limit: '300' });
        if (token) {
          params.append('next_token', token);
        }

        const url = config.getApiUrl(
          `api/proxy/api/infraweave/api/v1/logs/${project}/${region}/${encodedJobId}?${params.toString()}`,
        );
        console.log('[LOGS] 📡 Request URL:', url);

        // Using config.getApiUrl() instead of backendBaseUrl
        const response = await config.fetch(url);

        if (response.status >= 300 && response.status < 400) {
          throw new Error('Redirected to login or guest page');
        }

        const json = await response.json();

        // Handle case where nextForwardToken might be in headers or body
        // The backend might be returning it in headers now due to recent changes
        const nextForwardToken = json.nextForwardToken || response.headers.get('x-next-token');

        console.log('[LOGS] 📦 Response:', {
          logsLength: json.logs?.length || 0,
          logsPreview: truncateLogs(json.logs, 80),
          hasBackwardToken: !!json.nextBackwardToken,
          hasForwardToken: !!nextForwardToken,
          backwardTokenPreview: json.nextBackwardToken?.substring(0, 20),
          forwardTokenPreview: nextForwardToken?.substring(0, 20),
        });

        // If the backend returns empty logs but has a forward token, it means "keep polling".
        // However, if we get stuck in a loop of empty responses with tokens, we should handle it gracefully.

        return {
          ...json,
          nextForwardToken: nextForwardToken || json.nextForwardToken,
        };
      } catch (err) {
        console.error('[LOGS] ❌ Error fetching logs:', err);
        throw err;
      }
    },
    [config, encodedJobId, project, region],
  );

  // Function to fetch all logs with pagination
  const fetchAllLogs = useCallback(async (): Promise<void> => {
    console.log('[LOGS] 🚀 Starting initial full log fetch');
    let currentToken: string | undefined = undefined;
    let allLogs = '';
    let currentChunk = '';
    let pageCount = 0;
    const seenTokens = new Set<string>();

    updateLogs('');
    updateNextForwardToken(undefined);
    lastLogChunkRef.current = '';
    setHasInitialLoad(false);

    try {
      // Keep fetching forward until we have all logs
      do {
        pageCount++;
        console.log(`[LOGS] 📄 Fetching page ${pageCount}`);

        const result = await fetchLogs(currentToken);

        // Get next token for pagination
        const nextToken = result.nextForwardToken;

        // Check for infinite loop - if we've seen this token before, stop without appending
        if (nextToken && seenTokens.has(nextToken)) {
          // If we have logs, we can stop. If we don't, it might be that we just need to wait.
          // But since this is specific to pagination which should progress:
          console.log('[LOGS] 🔁 Detected infinite loop - same forward token seen twice, stopping');
          currentToken = nextToken;
          break;
        }

        // Empty pages mean we are caught up for now. Keep the newest token for polling,
        // but do not chase token-only responses in a tight initial-load loop.
        if (!result.logs) {
          console.log('[LOGS] 💤 Empty page during initial fetch - switching to polling');
          currentChunk = '';
          currentToken = nextToken || currentToken;
          break;
        }

        console.log(`[LOGS] ➕ Adding ${result.logs.length} chars to logs`);
        allLogs += result.logs;
        currentChunk = result.logs;
        // Update logs state incrementally to show progress, but not too often to avoid render thrashing
        if (pageCount % 5 === 0 || allLogs.length < 50000) {
          updateLogs(allLogs);
        }

        // Track this token
        if (nextToken) {
          seenTokens.add(nextToken);
          console.log(`[LOGS] ➡️ Has forward token, continuing to fetch more logs`);
          currentToken = nextToken;
        } else {
          console.log('[LOGS] ✅ No more forward token - reached the end');

          // Check if we are really done or just waiting for more
          const isDone = allLogs.trim().endsWith('Done!') || allLogs.includes('Done!\n');

          if (isDone) {
            console.log('[LOGS] 🏁 Logs contain "Done!", stopping polling');
            currentToken = undefined;
          } else {
            console.log('[LOGS] ⏳ No "Done!" found, keeping current token for polling');
            // Keep the currentToken to retry fetching from the same point
            // This is crucial if the backend doesn't return a nextToken but the job isn't finished
          }
          break; // Exit the initial load loop, but let auto-refresh continue with currentToken
        }

        // Safety limit to prevent infinite loops
        if (pageCount >= INITIAL_FETCH_PAGE_LIMIT) {
          console.log(
            `[LOGS] ⚠️ Reached safety limit of ${INITIAL_FETCH_PAGE_LIMIT} pages, stopping`,
          );
          break;
        }
      } while (currentToken);

      console.log(
        `[LOGS] 🏁 Initial fetch complete. Total pages: ${pageCount}, Total chars: ${allLogs.length}`,
      );
      updateLogs(allLogs);
      updateNextForwardToken(currentToken);
      lastLogChunkRef.current = currentChunk;
      setHasInitialLoad(true);
    } catch (err) {
      console.error('[LOGS] ❌ Error fetching all logs:', err);
      // If we failed initially (e.g. 404 logs not found yet), we should not die.
      // We should set initial load to true so polling can try again later.
      // But we check if it is a "real" error or just missing logs.
      // For now, let's assume if it fails, we treat it as empty logs and let polling handle it.
      setHasInitialLoad(true);
      // Do NOT rethrow if we want to survive 404s
      // throw err;
    }
  }, [fetchLogs, updateLogs, updateNextForwardToken]);

  // Initial fetch using useAsync
  const {
    value: _value,
    loading,
    error: asyncError,
  } = useAsync(async () => {
    await fetchAllLogs();
    return { logs: '', nextBackwardToken: undefined, nextForwardToken: undefined }; // Return dummy value since we're managing state directly
  }, [fetchAllLogs]);

  // Auto-refresh logic using useEffect - continues fetching new logs
  useEffect(() => {
    if (!hasInitialLoad) {
      return; // Wait for initial load to complete
    }

    console.log('[LOGS] ⏰ Setting up auto-refresh interval');
    let isLoadingRef = false;
    let isCancelled = false;

    // Set up the auto-refresh interval to check for new logs
    const interval = setInterval(async () => {
      if (isLoadingRef) {
        console.log('[LOGS] ⏭️ Skipping refresh - already loading');
        return; // Skip if already loading
      }

      // If we don't have a token yet, it implies we are done or waiting
      // But we should check if we really are "Done!"
      if (!nextForwardTokenRef.current) {
        const currentLogs = logsRef.current;
        const isDone = currentLogs.trim().endsWith('Done!') || currentLogs.includes('Done!\n');

        if (isDone) {
          console.log('[LOGS] ⏭️ logs contain "Done!" and no forward token, stopping polling');
          return;
        }

        console.log(
          '[LOGS] ⚠️ No forward token but not Done - polling with initial state (undefined token)',
        );
        // Continue to allow polling even if token is undefined (restart form head)
      }

      const currentToken = nextForwardTokenRef.current;
      console.log('[LOGS] 🔄 Auto-refresh triggered');

      try {
        isLoadingRef = true;
        setIsLoadingMore(true);

        const result = await fetchLogs(currentToken);
        if (isCancelled) return;
        const newLogs = result.logs || '';

        // Only append logs if the forward token is different (meaning we got new data)
        // OR if the token is reused but we got new content (deduplicate against last chunk)
        if (result.nextForwardToken && result.nextForwardToken !== currentToken) {
          if (newLogs.length > 0) {
            console.log(`[LOGS] ➕ Appending ${newLogs.length} new chars (new forward token)`);
            appendLogs(newLogs);
          } else {
            console.log('[LOGS] 💤 No new logs available');
          }
          console.log('[LOGS] ➡️ Updating forward token');
          updateNextForwardToken(result.nextForwardToken);
        } else {
          // Token didn't change or is undefined.
          // This happens if we are at the end, or if we are polling with same token.
          // Check if we got new content
          if (newLogs.length > 0) {
            // Potential duplicate if we are re-reading the same segment.
            // Check against lastLogChunk
            if (newLogs === lastLogChunkRef.current) {
              console.log('[LOGS] 🔁 Received identical log chunk, ignoring');
            } else if (newLogs.startsWith(lastLogChunkRef.current)) {
              // New content appended to the same chunk
              const diff = newLogs.substring(lastLogChunkRef.current.length);
              if (diff.length > 0) {
                console.log(`[LOGS] ➕ Appending ${diff.length} new chars (extended chunk)`);
                appendLogs(diff);
                lastLogChunkRef.current = newLogs;
              } else {
                console.log('[LOGS] 🔁 Log chunk matched prefix but no new content');
              }
            } else {
              // Totally different content? This is unexpected if token is same.
              // It might be that the token moves implicitly?
              // Or simple append?
              // Safest is to append if it doesn't look like we already have it at the end.
              console.log(`[LOGS] ➕ Appending ${newLogs.length} chars (non-matching chunk)`);
              appendLogs(newLogs);
            }
          } else {
            console.log('[LOGS] 💤 No new logs available');
          }

          // If we got a token (even if same), keep it.
          // If we got NO token, we check Done logic again next time?
          // We need to ensure we don't lose our polling capability.

          if (result.nextForwardToken) {
            updateNextForwardToken(result.nextForwardToken);
          } else {
            // If response has no token, we should keep our currentToken unless Done.
            const currentLogs = logsRef.current + newLogs; // Approximation of current state
            const isDone = currentLogs.trim().endsWith('Done!') || currentLogs.includes('Done!\n');
            if (isDone) {
              updateNextForwardToken(undefined);
            }
            // Else keep currentToken
          }
        }
      } catch (err) {
        console.error('[LOGS] ❌ Failed to fetch logs during auto-refresh:', err);
      } finally {
        isLoadingRef = false;
        setIsLoadingMore(false);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      console.log('[LOGS] 🛑 Cleaning up auto-refresh interval');
      isCancelled = true;
      clearInterval(interval);
    };
  }, [appendLogs, fetchLogs, hasInitialLoad, updateNextForwardToken]); // Stable refs hold the latest token/log state.

  // Error handling
  if (error) {
    return <ResponseErrorPanel error={error ?? asyncError} />;
  }

  // Only show loading spinner on initial load
  if (loading && !hasInitialLoad) {
    return <Progress />;
  }

  return <LogViewer text={logs ?? 'failed to fetch logs'} />;
};
