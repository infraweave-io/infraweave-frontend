import React, { useState, useEffect } from 'react';
import { styled, alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DiffEditor } from '@monaco-editor/react';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import { useTreeItem2, UseTreeItem2Parameters } from '@mui/x-tree-view/useTreeItem2';
import {
  TreeItem2Content,
  TreeItem2IconContainer,
  TreeItem2Root,
  TreeItem2GroupTransition,
} from '@mui/x-tree-view/TreeItem2';
import { TreeItem2Icon } from '@mui/x-tree-view/TreeItem2Icon';
import { TreeItem2Provider } from '@mui/x-tree-view/TreeItem2Provider';
import { TreeViewBaseItem } from '@mui/x-tree-view/models';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CodeIcon from '@mui/icons-material/Code';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import DataObjectIcon from '@mui/icons-material/DataObject';
import ImageIcon from '@mui/icons-material/Image';
import TableChartIcon from '@mui/icons-material/TableChart';
import { useThemeMode } from '../../contexts/ThemeContext';
import { VersionDiff } from '../../types/Module';
import clsx from 'clsx';

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return CodeIcon;
    case 'json':
      return DataObjectIcon;
    case 'md':
      return DescriptionIcon;
    case 'yml':
    case 'yaml':
      return SettingsIcon;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
      return ImageIcon;
    case 'csv':
      return TableChartIcon;
    default:
      return InsertDriveFileIcon;
  }
};

interface ZipDiffBrowserProps {
  fileDiff: VersionDiff;
  height?: string | number;
}

interface FileNode extends TreeViewBaseItem {
  path: string;
  isDir: boolean;
  status?: 'added' | 'removed' | 'changed' | 'unchanged' | 'moved';
  movedFrom?: string;
  children?: FileNode[];
}

const StyledTreeItemRoot = styled(TreeItem2Root)(({ theme }) => ({
  color: theme.palette.text.secondary,
  position: 'relative',
  [`& .${TreeItem2GroupTransition}`]: {
    marginLeft: theme.spacing(3.5),
  },
}));

const CustomTreeItemContent = styled(TreeItem2Content)(({ theme }) => ({
  borderRadius: theme.spacing(0.5),
  padding: theme.spacing(0.5, 1),
  margin: theme.spacing(0.2, 0),
  '&.Mui-selected, &.Mui-selected.Mui-focused': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    color: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.12),
    },
  },
  '&:hover': {
    backgroundColor: alpha(theme.palette.action.hover, 0.1),
  },
}));

const CustomTreeItem = React.forwardRef(function CustomTreeItem(
  props: Omit<UseTreeItem2Parameters, 'rootRef'> &
    Omit<React.HTMLAttributes<HTMLLIElement>, 'onFocus'>,
  ref: React.Ref<HTMLLIElement>,
) {
  const { id, itemId, label, disabled, children, ...other } = props;

  const {
    getRootProps,
    getContentProps,
    getIconContainerProps,
    getLabelProps: _getLabelProps,
    getGroupTransitionProps,
    status,
    publicAPI,
  } = useTreeItem2({ id, itemId, children, label, disabled, rootRef: ref });

  const item = publicAPI.getItem(itemId) as FileNode;
  const Icon = item.isDir ? FolderIcon : getFileIcon(item.label);

  const iconColor =
    item.status === 'added'
      ? 'success.main'
      : item.status === 'removed'
        ? 'error.main'
        : item.status === 'changed'
          ? 'warning.main'
          : item.status === 'moved'
            ? 'info.main'
            : 'action.active';

  const textColor =
    item.status === 'added'
      ? 'success.main'
      : item.status === 'removed'
        ? 'error.main'
        : item.status === 'changed'
          ? 'warning.main'
          : item.status === 'moved'
            ? 'info.main'
            : 'text.primary';

  return (
    <TreeItem2Provider itemId={itemId}>
      <StyledTreeItemRoot {...getRootProps(other)}>
        <CustomTreeItemContent
          {...getContentProps({
            className: clsx('content', {
              'Mui-expanded': status.expanded,
              'Mui-selected': status.selected,
              'Mui-focused': status.focused,
              'Mui-disabled': status.disabled,
            }),
          })}
        >
          <TreeItem2IconContainer {...getIconContainerProps()}>
            <TreeItem2Icon status={status} />
          </TreeItem2IconContainer>

          <Box display="flex" alignItems="center" p={0.5} flexGrow={1}>
            <Box
              component={Icon}
              sx={{ mr: 1, color: item.isDir ? 'action.active' : iconColor, fontSize: 20 }}
            />
            <Typography
              variant="body2"
              sx={{
                color: textColor,
                fontWeight: item.isDir ? 500 : 400,
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              }}
            >
              {label}
            </Typography>
          </Box>
        </CustomTreeItemContent>
        {children && <TreeItem2GroupTransition {...getGroupTransitionProps()} />}
      </StyledTreeItemRoot>
    </TreeItem2Provider>
  );
});

const getLanguage = (filename: string) => {
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
  if (filename.endsWith('.yaml') || filename.endsWith('.yml')) return 'yaml';
  if (filename.endsWith('.md')) return 'markdown';
  if (filename.endsWith('.css')) return 'css';
  if (filename.endsWith('.html')) return 'html';
  if (filename.endsWith('.tf') || filename.endsWith('.hcl')) return 'hcl';
  return undefined;
};

export const ZipDiffBrowser = ({ fileDiff, height = 600 }: ZipDiffBrowserProps) => {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileDiff, setSelectedFileDiff] = useState<{
    old?: string;
    new?: string;
    status: string;
    movedFrom?: string;
  } | null>(null);
  const { mode } = useThemeMode();

  useEffect(() => {
    const buildTree = () => {
      const root: FileNode[] = [];
      const paths = new Set<string>();
      const fileStatus: Record<string, 'added' | 'removed' | 'changed' | 'unchanged' | 'moved'> =
        {};
      const movedOrigins: Record<string, string> = {};

      fileDiff.added.forEach((f) => {
        const p = f.path.startsWith('/') ? f.path.slice(1) : f.path;
        paths.add(p);
        fileStatus[p] = 'added';
      });
      fileDiff.removed.forEach((f) => {
        const p = f.path.startsWith('/') ? f.path.slice(1) : f.path;
        paths.add(p);
        fileStatus[p] = 'removed';
      });
      fileDiff.changed.forEach((f) => {
        const p = f.path.startsWith('/') ? f.path.slice(1) : f.path;
        paths.add(p);
        fileStatus[p] = 'changed';
      });
      if (fileDiff.moved) {
        fileDiff.moved.forEach((f) => {
          const p = f.newPath.startsWith('/') ? f.newPath.slice(1) : f.newPath;
          paths.add(p);
          fileStatus[p] = 'moved';
          movedOrigins[p] = f.oldPath;
        });
      }
      if (fileDiff.unchanged) {
        fileDiff.unchanged.forEach((f) => {
          const p = f.path.startsWith('/') ? f.path.slice(1) : f.path;
          paths.add(p);
          fileStatus[p] = 'unchanged';
        });
      }

      const sortedPaths = Array.from(paths).sort();

      sortedPaths.forEach((filePath) => {
        const parts = filePath.split('/').filter((p) => p);
        let currentLevel = root;
        let currentPath = '';

        parts.forEach((part, index) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          const isLast = index === parts.length - 1;
          const isDir = !isLast;

          let node = currentLevel.find((n) => n.label === part);

          if (!node) {
            node = {
              id: currentPath,
              label: part,
              path: currentPath,
              isDir: isDir,
              children: isDir ? [] : undefined,
              status: isLast ? fileStatus[filePath] : undefined,
              movedFrom: isLast ? movedOrigins[filePath] : undefined,
            };
            currentLevel.push(node);
          }

          if (isDir) {
            currentLevel = node.children!;
          }
        });
      });

      setFileTree(root);
    };

    buildTree();
  }, [fileDiff]);

  const handleFileSelect = (_event: React.SyntheticEvent, itemId: string, isSelected?: boolean) => {
    if (isSelected === false) return;

    // Find the file in the diff data
    const path = itemId.startsWith('/') ? itemId : `/${itemId}`;

    const updateSelection = (diffData: {
      old?: string;
      new?: string;
      status: string;
      movedFrom?: string;
    }) => {
      setSelectedFile(itemId);
      setSelectedFileDiff(diffData);
    };

    const added = fileDiff.added.find((f) => f.path === path);
    if (added) {
      updateSelection({ new: added.value, status: 'added' });
      return;
    }

    const removed = fileDiff.removed.find((f) => f.path === path);
    if (removed) {
      updateSelection({ old: removed.value, status: 'removed' });
      return;
    }

    const changed = fileDiff.changed.find((f) => f.path === path);
    if (changed) {
      updateSelection({ old: changed.old_value, new: changed.new_value, status: 'changed' });
      return;
    }

    if (fileDiff.moved) {
      const moved = fileDiff.moved.find((f) => f.newPath === path);
      if (moved) {
        updateSelection({
          old: moved.old_value,
          new: moved.new_value,
          status: 'moved',
          movedFrom: moved.oldPath,
        });
        return;
      }
    }

    if (fileDiff.unchanged) {
      const unchanged = fileDiff.unchanged.find((f) => f.path === path);
      if (unchanged) {
        updateSelection({ old: unchanged.value, new: unchanged.value, status: 'unchanged' });
        return;
      }
    }
  };

  return (
    <Box
      display="flex"
      height={height}
      border={1}
      borderColor="divider"
      borderRadius={1}
      overflow="hidden"
    >
      <Box
        width="280px"
        flexShrink={0}
        borderRight={1}
        borderColor="divider"
        overflow="auto"
        bgcolor="background.paper"
      >
        <RichTreeView
          items={fileTree}
          onItemSelectionToggle={handleFileSelect}
          slots={{ item: CustomTreeItem }}
        />
      </Box>
      <Box
        flexGrow={1}
        display="flex"
        flexDirection="column"
        bgcolor="background.paper"
        minWidth={0}
      >
        {selectedFile && selectedFileDiff ? (
          <Box flexGrow={1} overflow="hidden" display="flex" flexDirection="column" height="100%">
            <Box
              p={1}
              bgcolor="background.default"
              borderBottom={1}
              borderColor="divider"
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="caption">
                {selectedFile} ({selectedFileDiff.status})
              </Typography>
            </Box>
            <Box flexGrow={1} overflow="hidden">
              <DiffEditor
                original={selectedFileDiff.old || ''}
                modified={selectedFileDiff.new || ''}
                language={getLanguage(selectedFile || '')}
                theme={mode === 'dark' ? 'vs-dark' : 'light'}
                options={{
                  renderSideBySide: selectedFileDiff.status !== 'unchanged',
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                  ignoreTrimWhitespace: true,
                }}
              />
            </Box>
          </Box>
        ) : (
          <Box display="flex" justifyContent="center" alignItems="center" flexGrow={1}>
            <Typography color="textSecondary">Select a file to view changes</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};
