import React, { useState, useEffect } from 'react';
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
  const [nextForwardToken, setNextForwardToken] = useState<string | undefined>(undefined);
  const [_isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastLogChunk, setLastLogChunk] = useState<string>('');

  // Helper to truncate logs for debug output
  const truncateLogs = (logText: string, maxLength: number = 100): string => {
    if (!logText) return '(empty)';
    if (logText.length <= maxLength) return logText;
    return `${logText.substring(0, maxLength)}... [truncated, total length: ${logText.length}]`;
  };

  // Function to fetch logs with pagination support
  const config = useConfig();
  const fetchLogs = async (token?: string): Promise<Log> => {
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
  };

  // Function to fetch all logs with pagination
  const fetchAllLogs = async (): Promise<void> => {
    console.log('[LOGS] 🚀 Starting initial full log fetch');
    let currentToken: string | undefined = undefined;
    let allLogs = '';
    let currentChunk = '';
    let pageCount = 0;
    const seenTokens = new Set<string>();

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
          setNextForwardToken(nextToken);
          break;
        }

        // If we get empty logs but a new forward token, we should probably continue BUT if this happens many times in a row
        // during initial fetch, we might want to be careful not to hammer the API if it's just "keep alive" polling.
        // For initial fetch, we typically want to grab "existing" logs. If it's returning empty + token,
        // it might mean we are at the "tail" already or it's sparse logs.

        // Append logs only if we haven't seen this token before (meaning it's new data)
        if (result.logs) {
          console.log(`[LOGS] ➕ Adding ${result.logs.length} chars to logs`);
          allLogs += result.logs;
          currentChunk = result.logs;
          // Update logs state incrementally to show progress, but not too often to avoid render thrashing
          if (pageCount % 5 === 0 || allLogs.length < 50000) {
            setLogs(allLogs);
          }
        } else {
          console.log('[LOGS] ⚠️ No logs in response');
          currentChunk = '';
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
        if (pageCount >= 100) {
          console.log('[LOGS] ⚠️ Reached safety limit of 100 pages, stopping');
          break;
        }
      } while (currentToken);

      console.log(
        `[LOGS] 🏁 Initial fetch complete. Total pages: ${pageCount}, Total chars: ${allLogs.length}`,
      );
      setLogs(allLogs);
      setNextForwardToken(currentToken);
      setLastLogChunk(currentChunk);
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
  };

  // Initial fetch using useAsync
  const {
    value: _value,
    loading,
    error: asyncError,
  } = useAsync(async () => {
    await fetchAllLogs();
    return { logs: '', nextBackwardToken: undefined, nextForwardToken: undefined }; // Return dummy value since we're managing state directly
  }, [event]);

  // Auto-refresh logic using useEffect - continues fetching new logs
  useEffect(() => {
    if (!hasInitialLoad) {
      return; // Wait for initial load to complete
    }

    console.log('[LOGS] ⏰ Setting up auto-refresh interval');
    let isLoadingRef = false;

    // Set up the auto-refresh interval to check for new logs
    const interval = setInterval(async () => {
      if (isLoadingRef) {
        console.log('[LOGS] ⏭️ Skipping refresh - already loading');
        return; // Skip if already loading
      }

      // If we don't have a token yet, it implies we are done or waiting
      // But we should check if we really are "Done!"
      if (!nextForwardToken) {
        const currentLogs = logs || '';
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

      const currentToken = nextForwardToken;
      console.log('[LOGS] 🔄 Auto-refresh triggered');

      try {
        isLoadingRef = true;
        setIsLoadingMore(true);

        const result = await fetchLogs(currentToken);

        // Only append logs if the forward token is different (meaning we got new data)
        // OR if the token is reused but we got new content (deduplicate against last chunk)
        if (result.nextForwardToken && result.nextForwardToken !== currentToken) {
          if (result.logs && result.logs.length > 0) {
            console.log(`[LOGS] ➕ Appending ${result.logs.length} new chars (new forward token)`);
            setLogs((prevLogs) => (prevLogs || '') + result.logs);
            setLastLogChunk(result.logs);
          }
          console.log('[LOGS] ➡️ Updating forward token');
          setNextForwardToken(result.nextForwardToken);
        } else {
          // Token didn't change or is undefined.
          // This happens if we are at the end, or if we are polling with same token.
          // Check if we got new content
          const newLogs = result.logs || '';

          if (newLogs.length > 0) {
            // Potential duplicate if we are re-reading the same segment.
            // Check against lastLogChunk
            if (newLogs === lastLogChunk) {
              console.log('[LOGS] 🔁 Received identical log chunk, ignoring');
            } else if (newLogs.startsWith(lastLogChunk)) {
              // New content appended to the same chunk
              const diff = newLogs.substring(lastLogChunk.length);
              if (diff.length > 0) {
                console.log(`[LOGS] ➕ Appending ${diff.length} new chars (extended chunk)`);
                setLogs((prevLogs) => (prevLogs || '') + diff);
                setLastLogChunk(newLogs);
              } else {
                console.log('[LOGS] 🔁 Log chunk matched prefix but no new content');
              }
            } else {
              // Totally different content? This is unexpected if token is same.
              // It might be that the token moves implicitly?
              // Or simple append?
              // Safest is to append if it doesn't look like we already have it at the end.
              console.log(`[LOGS] ➕ Appending ${newLogs.length} chars (non-matching chunk)`);
              setLogs((prevLogs) => {
                if (prevLogs && prevLogs.endsWith(newLogs)) {
                  return prevLogs;
                }
                return (prevLogs || '') + newLogs;
              });
              setLastLogChunk(newLogs);
            }
          } else {
            console.log('[LOGS] 💤 No new logs available');
          }

          // If we got a token (even if same), keep it.
          // If we got NO token, we check Done logic again next time?
          // We need to ensure we don't lose our polling capability.

          if (result.nextForwardToken) {
            setNextForwardToken(result.nextForwardToken);
          } else {
            // If response has no token, we should keep our currentToken unless Done.
            const currentLogs = (logs || '') + newLogs; // Approximation of current state
            const isDone = currentLogs.trim().endsWith('Done!') || currentLogs.includes('Done!\n');
            if (isDone) {
              setNextForwardToken(undefined);
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
    }, 5000); // Refresh every 5 seconds

    return () => {
      console.log('[LOGS] 🛑 Cleaning up auto-refresh interval');
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInitialLoad, nextForwardToken, logs, lastLogChunk]); // Depend on logs/chunk to handle polling logic correctly

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
