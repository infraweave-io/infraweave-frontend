import React from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { InfoCard, Link } from '../../standalone/components/ComponentAdapter';

/** Every widget is the same height so a row of them lines up; longer content scrolls. */
export const WIDGET_HEIGHT = 420;

type WidgetErrorBoundaryState = { error: Error | null };

/**
 * Keeps one crashing widget from taking down the page. React has no hook for catching render
 * errors, so this has to be a class.
 */
class WidgetErrorBoundary extends React.Component<
  { children: React.ReactNode },
  WidgetErrorBoundaryState
> {
  state: WidgetErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { error };
  }

  // React already logs the error, so there is nothing to add in componentDidCatch.

  render() {
    if (this.state.error) {
      return (
        <Alert
          severity="error"
          action={
            // Clearing the error mounts the widget afresh, so it fetches and renders again.
            <Button color="inherit" size="small" onClick={() => this.setState({ error: null })}>
              Retry
            </Button>
          }
        >
          This widget failed to load
        </Alert>
      );
    }
    return this.props.children;
  }
}

/** A page that shows more of what the widget previews. */
export type WidgetLink = { to: string; label: string };

type WidgetHolderProps = {
  title: string;
  /** Shown right after the title. */
  links?: WidgetLink[];
  /** Header controls, to the right of the title. */
  actions?: React.ReactNode;
  children: React.ReactNode;
};

/** The card every Overview widget sits in: a titled, fixed-height region. */
export const WidgetHolder = ({ title, links = [], actions, children }: WidgetHolderProps) => {
  const titleId = React.useId();
  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{
        height: WIDGET_HEIGHT,
        // InfoCard grows its content to fit; let it shrink and scroll inside the card instead.
        '& > .MuiCard-root > .MuiCardContent-root': { minHeight: 0, overflowY: 'auto' },
      }}
    >
      <InfoCard
        title={
          <Box
            component="span"
            sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}
          >
            {/* The region is named by the title alone, not its links. */}
            <span id={titleId}>{title}</span>
            {links.map((link) => (
              <Typography key={link.to} variant="body2" component="span">
                <Link to={link.to}>{link.label}</Link>
              </Typography>
            ))}
          </Box>
        }
        actions={actions}
      >
        <WidgetErrorBoundary>{children}</WidgetErrorBoundary>
      </InfoCard>
    </Box>
  );
};
