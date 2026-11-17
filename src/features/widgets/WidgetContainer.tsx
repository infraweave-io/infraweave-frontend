import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  ListSubheader,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import { WIDGET_HEIGHT, WidgetHolder, WidgetLink } from './WidgetHolder';
import { WidgetIdContext } from './widgetSettings';
import { WidgetReload, WidgetReloadContext } from './widgetReload';

export type WidgetDefinition = {
  /** Stored in the saved layout and settings, so it must not change once released. */
  id: string;
  title: string;
  /** Pages that show more of what the widget previews, linked beside its title. */
  links?: WidgetLink[];
  Component: React.ComponentType;
};

export type WidgetSize = 'small' | 'medium' | 'large';

/** A widget on the page and how many of the grid's three columns it spans. */
export type PlacedWidget = { id: string; size: WidgetSize };

export const WIDGET_SIZES: { value: WidgetSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

/** Three columns on large screens, two on medium ones, one below that. */
const GRID_SIZE: Record<WidgetSize, Record<string, number>> = {
  small: { xs: 12, md: 6, lg: 4 },
  medium: { xs: 12, lg: 8 },
  large: { xs: 12 },
};

type WidgetContainerProps = {
  /** Every widget that can be placed. */
  widgets: WidgetDefinition[];
  /** The widgets shown, in order. */
  layout: PlacedWidget[];
  onLayoutChange: (layout: PlacedWidget[]) => void;
  /** Shows the controls for moving, resizing, removing and adding widgets. */
  editing: boolean;
};

/** A reload that answers at once still spins this long, so the click visibly did something. */
const MIN_RELOAD_SPIN_MS = 500;

const move = (placed: PlacedWidget[], from: number, to: number): PlacedWidget[] => {
  const next = [...placed];
  const [widget] = next.splice(from, 1);
  next.splice(to, 0, widget);
  return next;
};

/** Lays out widgets on a responsive grid, in the order of `layout`. */
export const WidgetContainer = ({
  widgets,
  layout,
  onLayoutChange,
  editing,
}: WidgetContainerProps) => {
  const [addMenuAnchor, setAddMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [settingsMenu, setSettingsMenu] = React.useState<{
    id: string;
    anchor: HTMLElement;
  } | null>(null);

  // Filled in by widgets that call `useOnWidgetReload`; only they get a reload button.
  const reloaders = React.useRef(new Map<string, WidgetReload>());
  const [reloadable, setReloadable] = React.useState<ReadonlySet<string>>(new Set());
  const [reloading, setReloading] = React.useState<ReadonlySet<string>>(new Set());
  const registerReload = React.useCallback((id: string, reload: WidgetReload) => {
    reloaders.current.set(id, reload);
    setReloadable((prev) => new Set(prev).add(id));
    return () => {
      reloaders.current.delete(id);
      setReloadable((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };
  }, []);

  const reload = (id: string) => {
    const run = reloaders.current.get(id);
    if (!run) return;
    setReloading((prev) => new Set(prev).add(id));
    const minimumSpin = new Promise((resolve) => setTimeout(resolve, MIN_RELOAD_SPIN_MS));
    // A failed reload is the widget's to show; the button only stops spinning.
    Promise.allSettled([Promise.resolve().then(run), minimumSpin]).then(() =>
      setReloading((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }),
    );
  };

  // Edits work on what is shown, which also drops widgets that no longer exist.
  const shown = layout.flatMap((placed) => {
    const widget = widgets.find((other) => other.id === placed.id);
    return widget ? [{ ...placed, widget }] : [];
  });
  const placed: PlacedWidget[] = shown.map(({ id, size }) => ({ id, size }));
  const available = widgets.filter((widget) => !placed.some((other) => other.id === widget.id));

  const resize = (id: string, size: WidgetSize) =>
    onLayoutChange(placed.map((other) => (other.id === id ? { ...other, size } : other)));

  if (shown.length === 0 && !editing) {
    return (
      <Typography variant="body2" color="text.secondary">
        There are no widgets on this page. Use Customize to add some.
      </Typography>
    );
  }

  return (
    <WidgetReloadContext.Provider value={registerReload}>
      <Grid container spacing={2.5}>
        {shown.map(({ id, size, widget: { title, links, Component } }, index) => (
          <Grid key={id} size={GRID_SIZE[size]}>
            <WidgetHolder
              title={title}
              links={links}
              actions={
                <Box sx={{ display: 'flex' }}>
                  {reloadable.has(id) && (
                    <Tooltip title={reloading.has(id) ? 'Reloading' : 'Reload'}>
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`Reload ${title}`}
                          disabled={reloading.has(id)}
                          onClick={() => reload(id)}
                        >
                          {reloading.has(id) ? (
                            <CircularProgress size={18} aria-label={`Reloading ${title}`} />
                          ) : (
                            <RefreshIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  {editing && (
                    <>
                      <Tooltip title="Move earlier">
                        <span>
                          <IconButton
                            size="small"
                            aria-label={`Move ${title} earlier`}
                            disabled={index === 0}
                            onClick={() => onLayoutChange(move(placed, index, index - 1))}
                          >
                            <ArrowBackIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Move later">
                        <span>
                          <IconButton
                            size="small"
                            aria-label={`Move ${title} later`}
                            disabled={index === shown.length - 1}
                            onClick={() => onLayoutChange(move(placed, index, index + 1))}
                          >
                            <ArrowForwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Settings">
                        <IconButton
                          size="small"
                          aria-label={`Settings for ${title}`}
                          onClick={(e) => setSettingsMenu({ id, anchor: e.currentTarget })}
                        >
                          <SettingsIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove">
                        <IconButton
                          size="small"
                          aria-label={`Remove ${title}`}
                          onClick={() => onLayoutChange(placed.filter((other) => other.id !== id))}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </Box>
              }
            >
              <WidgetIdContext.Provider value={id}>
                <Component />
              </WidgetIdContext.Provider>
            </WidgetHolder>
          </Grid>
        ))}

        <Menu
          anchorEl={settingsMenu?.anchor}
          open={settingsMenu !== null}
          onClose={() => setSettingsMenu(null)}
        >
          <ListSubheader>Size</ListSubheader>
          {WIDGET_SIZES.map((option) => (
            <MenuItem
              key={option.value}
              selected={
                placed.find((other) => other.id === settingsMenu?.id)?.size === option.value
              }
              onClick={() => {
                if (settingsMenu) resize(settingsMenu.id, option.value);
                setSettingsMenu(null);
              }}
            >
              {option.label}
            </MenuItem>
          ))}
        </Menu>

        {editing && available.length > 0 && (
          <Grid size={GRID_SIZE.small}>
            <Box
              sx={{
                height: WIDGET_HEIGHT,
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Button startIcon={<AddIcon />} onClick={(e) => setAddMenuAnchor(e.currentTarget)}>
                Add widget
              </Button>
              <Menu
                anchorEl={addMenuAnchor}
                open={addMenuAnchor !== null}
                onClose={() => setAddMenuAnchor(null)}
              >
                {available.map((widget) => (
                  <MenuItem
                    key={widget.id}
                    onClick={() => {
                      setAddMenuAnchor(null);
                      onLayoutChange([...placed, { id: widget.id, size: 'small' }]);
                    }}
                  >
                    {widget.title}
                  </MenuItem>
                ))}
              </Menu>
            </Box>
          </Grid>
        )}
      </Grid>
    </WidgetReloadContext.Provider>
  );
};
