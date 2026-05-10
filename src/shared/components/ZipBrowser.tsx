import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { useConfig } from '../../hooks/useConfig';
import { styled, alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import DownloadIcon from '@mui/icons-material/Download';
import Editor from '@monaco-editor/react';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import { TreeItem2 } from '@mui/x-tree-view/TreeItem2';
import { useThemeMode } from '../../contexts/ThemeContext';

interface ZipBrowserProps {
  url: string;
  height?: string | number;
}

interface FileNode {
  id: string;
  label: string;
  children?: FileNode[];
  path: string;
  isDir: boolean;
}

const StyledTreeItem = styled(TreeItem2)(({ theme }) => ({
  color: theme.palette.text.secondary,
  '& .MuiTreeItem-content': {
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
  },
  '& .MuiTreeItem-iconContainer': {
    marginRight: theme.spacing(1),
  },
  '& .MuiTreeItem-label': {
    fontWeight: 'inherit',
    color: 'inherit',
  },
}));

const getLanguage = (filename: string) => {
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
  if (filename.endsWith('.yaml') || filename.endsWith('.yml')) return 'yaml';
  if (filename.endsWith('.md')) return 'markdown';
  if (filename.endsWith('.css')) return 'css';
  if (filename.endsWith('.html')) return 'html';
  if (filename.endsWith('.tf') || filename.endsWith('.hcl')) return 'hcl';
  if (filename.endsWith('.py')) return 'python';
  return undefined;
};

export const ZipBrowser = ({ url, height = 600 }: ZipBrowserProps) => {
  const config = useConfig();
  const [zip, setZip] = useState<JSZip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const { mode } = useThemeMode();

  const buildFileTree = (zipObj: JSZip): FileNode[] => {
    const root: FileNode[] = [];

    // Sort files to ensure folders are processed before files if needed,
    // but mainly to have a consistent order
    const sortedFiles = Object.keys(zipObj.files).sort();

    sortedFiles.forEach((filePath) => {
      const file = zipObj.files[filePath];
      const parts = filePath.split('/').filter((p) => p); // Remove empty strings from trailing slashes

      let currentLevel = root;
      let currentPath = '';

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isLast = index === parts.length - 1;
        const isDir = file.dir || !isLast; // It's a dir if marked as such OR if it's not the last part of the path

        // Check if node already exists at this level
        let node = currentLevel.find((n) => n.label === part);

        if (!node) {
          node = {
            id: currentPath,
            label: part,
            path: currentPath,
            isDir: isDir,
            children: isDir ? [] : undefined,
          };
          currentLevel.push(node);
        }

        if (isDir) {
          currentLevel = node.children!;
        }
      });
    });

    return root;
  };

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const loadZip = async () => {
      try {
        setLoading(true);
        setError(null);
        // Reset download URL when loading new zip
        setDownloadUrl(null);

        const response = await config.fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch zip: ${response.statusText}`);

        let blob: Blob;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          // Try to find a URL in the response
          const resolvedUrl =
            data.url || data.download_url || data.s3_url || data.presigned_url || data.link;

          if (resolvedUrl) {
            // Fetch from the provided URL (likely a presigned S3 URL)
            // Use native fetch to avoid adding API auth headers which might conflict with S3 signatures
            const zipResponse = await fetch(resolvedUrl);
            if (!zipResponse.ok)
              throw new Error(`Failed to fetch zip from storage: ${zipResponse.statusText}`);
            blob = await zipResponse.blob();
          } else {
            console.error('Received JSON response:', data);
            throw new Error('Received JSON response but could not find download URL');
          }
        } else {
          blob = await response.blob();
        }

        const loadedZip = await JSZip.loadAsync(blob);

        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setDownloadUrl(objectUrl);
          setZip(loadedZip);
          const tree = buildFileTree(loadedZip);
          setFileTree(tree);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unknown error loading zip');
          setLoading(false);
        }
      }
    };

    loadZip();
    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const handleFileSelect = async (event: React.SyntheticEvent, itemId: string) => {
    if (!zip) return;

    // Find the file in the zip
    // We need to check both exact match and potential directory match logic if needed,
    // but our IDs are paths.
    // Note: zip.files keys might have trailing slashes for directories.

    let zipEntry = zip.files[itemId];
    if (!zipEntry) {
      // Try adding a slash if it might be a directory
      zipEntry = zip.files[`${itemId}/`];
    }

    if (zipEntry && !zipEntry.dir) {
      try {
        setLoadingFile(true);
        setSelectedFile(itemId);
        const content = await zipEntry.async('string');
        setFileContent(content);
      } catch (err) {
        console.error('Error reading file:', err);
        setFileContent('Error reading file content');
      } finally {
        setLoadingFile(false);
      }
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={height}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={height}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

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
        width="30%"
        display="flex"
        flexDirection="column"
        borderRight={1}
        borderColor="divider"
        bgcolor="background.paper"
      >
        <Box flexGrow={1} overflow="auto">
          <RichTreeView
            items={fileTree}
            onItemSelectionToggle={handleFileSelect}
            slots={{ item: StyledTreeItem }}
          />
        </Box>
        <Box p={1} borderTop={1} borderColor="divider">
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            href={downloadUrl || '#'}
            download="archive.zip"
            disabled={!downloadUrl}
            fullWidth
          >
            Download Zip
          </Button>
        </Box>
      </Box>
      <Box width="70%" display="flex" flexDirection="column" bgcolor="background.paper">
        {(() => {
          if (selectedFile && loadingFile) {
            return (
              <Box display="flex" justifyContent="center" alignItems="center" flexGrow={1}>
                <CircularProgress size={24} />
              </Box>
            );
          }
          if (selectedFile) {
            return (
              <Box flexGrow={1} overflow="hidden">
                <Editor
                  height="100%"
                  language={getLanguage(selectedFile || '')}
                  value={fileContent}
                  theme={mode === 'dark' ? 'vs-dark' : 'light'}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 12,
                  }}
                />
              </Box>
            );
          }
          return (
            <Box display="flex" justifyContent="center" alignItems="center" flexGrow={1}>
              <Typography color="textSecondary">Select a file to view content</Typography>
            </Box>
          );
        })()}
      </Box>
    </Box>
  );
};
