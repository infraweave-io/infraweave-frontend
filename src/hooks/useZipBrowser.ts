import { useState } from 'react';

interface UseZipBrowserResult {
  open: boolean;
  url: string | null;
  resourceName: string;
  resourceVersion: string;
  browse: (url: string, name: string, version: string) => void;
  close: () => void;
}

export const useZipBrowser = (): UseZipBrowserResult => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [resourceName, setResourceName] = useState('');
  const [resourceVersion, setResourceVersion] = useState('');

  const browse = (zipUrl: string, name: string, version: string) => {
    setUrl(zipUrl);
    setResourceName(name);
    setResourceVersion(version);
    setOpen(true);
  };

  const close = () => setOpen(false);

  return { open, url, resourceName, resourceVersion, browse, close };
};
