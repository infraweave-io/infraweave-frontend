import { useState, useEffect } from 'react';
import { AppConfig } from '../contexts/ConfigContext';

interface UseAvailableTracksResult {
  availableTracks: string[];
  selectedTrack: string;
  setSelectedTrack: (track: string) => void;
}

const TRACKS = ['stable', 'beta', 'alpha', 'dev'];

export const useAvailableTracks = (
  resourceName: string | undefined,
  resourceLabel: string,
  config: AppConfig,
  enabled: boolean,
  initialTrack = 'stable',
): UseAvailableTracksResult => {
  const [availableTracks, setAvailableTracks] = useState<string[]>([]);
  const [selectedTrack, setSelectedTrack] = useState(initialTrack);

  useEffect(() => {
    if (!enabled || !resourceName) return;

    const fetchTracks = async () => {
      const tracksWithVersions: string[] = [];

      for (const track of TRACKS) {
        try {
          const response = await config.fetch(
            config.getApiUrl(
              `api/proxy/api/infraweave/api/v1/${resourceLabel}s/versions/${track}/${resourceName}`,
            ),
          );
          if (response.ok) {
            const json = await response.json();
            if (json && json.length > 0) {
              tracksWithVersions.push(track);
            }
          }
        } catch {
          // Track not available
        }
      }

      setAvailableTracks(tracksWithVersions);
      if (tracksWithVersions.length > 0 && !tracksWithVersions.includes(selectedTrack)) {
        setSelectedTrack(tracksWithVersions[0]);
      }
    };

    fetchTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, resourceName, config]);

  return { availableTracks, selectedTrack, setSelectedTrack };
};
