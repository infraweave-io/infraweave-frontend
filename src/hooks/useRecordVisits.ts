import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { recordVisit } from '../utils/visitHistory';

/** Mounted once around the routes, so every page the user opens is remembered. */
export const useRecordVisits = (): void => {
  const { pathname } = useLocation();
  useEffect(() => {
    recordVisit(pathname);
  }, [pathname]);
};
