import React, { useCallback, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Panel,
  BackgroundVariant,
} from '@xyflow/react';
import ReactJson from '@microlink/react-json-view';
import { getLayoutedElements } from './elk-layout';
import { AttributeEdge, GroupNode } from './CustomNodes';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import hcl from 'react-syntax-highlighter/dist/esm/languages/prism/hcl';
import { vs, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

import '@xyflow/react/dist/style.css';
import './styles.css';

SyntaxHighlighter.registerLanguage('hcl', hcl);

const nodeTypes = {
  group: GroupNode,
};

const edgeTypes = {
  attribute: AttributeEdge,
};

const THEMES: any = {
  dark: {
    bg: '#0d1117',
    grid: '#21262d',
    gridThickness: 1,
    nodeBg: '#161b22',
    nodeBorder: '#30363d',
    nodeColor: '#c9d1d9',
    edge: '#444c56',
    edgeDim: '#222',
    groupLabel: '#388bfd',
    panelBg: 'bg-gray-900',
    panelBorder: 'border-gray-700',
    panelText: 'text-white',
    panelTextDim: 'text-gray-400',
    nodeActionCreate: '#2ea043',
    nodeActionCreateBg: '#0f2d18',
    nodeActionUpdate: '#d29922',
    nodeActionUpdateBg: '#342a0a',
    nodeActionDelete: '#f85149',
    nodeActionDeleteBg: '#401212',
    nodeDataBorder: '#a78bfa',
    nodeDataBg: '#2e1065',
  },
  light: {
    bg: '#ffffff',
    grid: '#f4f4f4',
    gridThickness: 0.5,
    nodeBg: '#ffffff',
    nodeBorder: '#d0d7de',
    nodeColor: '#24292f',
    edge: '#8c959f',
    edgeDim: '#eaeef2',
    groupLabel: '#0969da',
    panelBg: 'bg-white',
    panelBorder: 'border-gray-200',
    panelText: 'text-black',
    panelTextDim: 'text-gray-600',
    nodeActionCreate: '#1a7f37',
    nodeActionCreateBg: '#e6ffec',
    nodeActionUpdate: '#9a6700',
    nodeActionUpdateBg: '#fff8c5',
    nodeActionDelete: '#cf222e',
    nodeActionDeleteBg: '#ffebe9',
    nodeDataBorder: '#8b5cf6',
    nodeDataBg: '#f3e8ff',
  },
};

export interface TerraformFlowProps {
  dataUrl?: string; // URL from which to fetch graph data
  initialData?: { nodes: any[]; edges: any[] }; // Direct data injection
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

// Recursive function to filter sensitive, unknown, and null values
const filterValues = (data: any, options: { hideNulls: boolean; hideUnknowns: boolean }): any => {
  if (data === null) return options.hideNulls ? undefined : data;
  if (typeof data === 'string') {
    // Check for common Terraform placeholders
    if (
      // data === '(sensitive value)' || // User requested to keep sensitive values
      options.hideUnknowns &&
      data === '(known after apply)'
    )
      return undefined;
    return data;
  }
  if (Array.isArray(data)) {
    const filtered = data
      .map((item) => filterValues(item, options))
      .filter((v: any) => v !== undefined);
    return filtered.length > 0 ? filtered : undefined;
  }
  if (typeof data === 'object') {
    const result: any = {};
    let hasProps = false;
    for (const key in data) {
      const val = filterValues(data[key], options);
      if (val !== undefined) {
        result[key] = val;
        hasProps = true;
      }
    }
    return hasProps ? result : undefined;
  }
  return data;
};

const HclViewer = ({
  code,
  theme,
  currentTheme,
}: {
  code: string;
  theme: string;
  currentTheme: any;
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const [isOverflowing, setIsOverflowing] = React.useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Reset expansion when code changes (new node selected)
  React.useEffect(() => {
    setExpanded(false);
  }, [code]);

  // Check for overflow on render and resize
  React.useLayoutEffect(() => {
    const checkOverflow = () => {
      if (contentRef.current) {
        // Check if scrollHeight exceeds the collapsed height (200px)
        setIsOverflowing(contentRef.current.scrollHeight > 200);
      }
    };

    checkOverflow();

    // Also check on window resize as text wrapping might change height
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [code]);

  return (
    <div className={`mt-2 border-t ${currentTheme.panelBorder} pt-3`}>
      <h2 className="text-sm font-bold mb-2">HCL Configuration</h2>
      <div className="text-[10px] rounded overflow-hidden relative group pb-8">
        <div
          ref={contentRef}
          style={{
            maxHeight: expanded ? 'none' : '200px',
            overflow: 'hidden',
            transition: 'max-height 0.5s ease-in-out',
            position: 'relative',
          }}
        >
          <SyntaxHighlighter
            language="hcl"
            style={theme === 'dark' ? vscDarkPlus : vs}
            customStyle={{
              margin: 0,
              padding: '10px',
              // Add extra padding at bottom if collapsed vs expanded to avoid cut-off feel before gradient
              paddingBottom: isOverflowing && !expanded ? '30px' : '10px',
              borderRadius: '4px',
              fontSize: '13px',
              lineHeight: '1.4',
              backgroundColor: theme === 'dark' ? '#0d1117' : '#f6f8fa',
              border: `1px solid ${currentTheme.nodeBorder}`,
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>

        {isOverflowing && (
          <div
            className="absolute bottom-0 left-0 w-full flex items-end justify-center transition-all duration-500 ease-in-out pointer-events-none"
            style={{
              height: expanded ? '3rem' : '6rem',
              background: expanded
                ? 'transparent'
                : `linear-gradient(to top, ${theme === 'dark' ? '#161b22' : '#ffffff'} 0%, ${
                    theme === 'dark' ? 'rgba(22, 27, 34, 0.8)' : 'rgba(255, 255, 255, 0.8)'
                  } 50%, transparent 100%)`,
            }}
          >
            <button
              onClick={() => setExpanded(!expanded)}
              className={`mb-2 text-[10px] font-bold px-4 py-1 rounded-full shadow-md transform hover:scale-105 transition-all duration-200 flex items-center gap-1 pointer-events-auto ${
                theme === 'dark'
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-blue-500 text-white hover:bg-blue-400'
              }`}
            >
              <span>{expanded ? 'Show less' : 'Show more'}</span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-300 ${
                  expanded ? 'rotate-180' : 'rotate-0'
                }`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

function TerraformFlowContent({ dataUrl, initialData, fetcher }: TerraformFlowProps) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // State for highlighting
  const [highlightId, setHighlightId] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<string[]>([]);
  const [theme, setTheme] = React.useState('dark');
  const [loadingError, setLoadingError] = React.useState<string | null>(null);
  const [hideSensitive, setHideSensitive] = React.useState(false); // Used for "hide unknowns"
  const [hideNulls, setHideNulls] = React.useState(false);
  const initRef = useRef(false);

  // State for resizable panel
  const [panelWidth, setPanelWidth] = React.useState(384); // Default to max-w-sm (approx 384px)
  const isResizingRef = React.useRef(false);

  const currentTheme = THEMES[theme];

  // Calculated stats excluding variables, outputs, and structual groups from count
  const stats = React.useMemo(() => {
    const relevantNodes = nodes.filter((n) => {
      // Exclude structural group nodes (modules, root containers)
      if (n.type === 'group') return false;

      const type = (n.data?.type || '').toLowerCase();
      // Exclude inputs, outputs, etc
      return type !== 'variable' && type !== 'var' && type !== 'output';
    });

    const relevantNodeIds = new Set(relevantNodes.map((n) => n.id));

    const relevantEdges = edges.filter(
      (e) => relevantNodeIds.has(e.source) && relevantNodeIds.has(e.target),
    );

    return {
      nodes: relevantNodes.length,
      edges: relevantEdges.length,
    };
  }, [nodes, edges]);

  // Remap edges that reference non-existent module outputs to actual resources
  const remapInvalidEdges = useCallback((nodes: any[], edges: any[]) => {
    const nodeIds = new Set(nodes.map((n) => n.id));

    return edges.map((edge) => {
      let newSource = edge.source;
      let newTarget = edge.target;

      // Check if source is a non-existent module output
      if (!nodeIds.has(edge.source) && edge.source.includes('.output.')) {
        // Extract module path (everything before .output.)
        const modulePath = edge.source.split('.output.')[0];
        // Find a resource in that module - prefer aws_eks_cluster or similar main resources
        const moduleResource = nodes.find(
          (n) =>
            n.id.startsWith(`${modulePath}.`) &&
            !n.id.includes('.output.') &&
            (n.data?.type === 'resource' || n.data?.type === 'data'),
        );
        if (moduleResource) {
          newSource = moduleResource.id;
        }
      }

      // Check if target is a non-existent module output
      if (!nodeIds.has(edge.target) && edge.target.includes('.output.')) {
        const modulePath = edge.target.split('.output.')[0];
        const moduleResource = nodes.find(
          (n) =>
            n.id.startsWith(`${modulePath}.`) &&
            !n.id.includes('.output.') &&
            (n.data?.type === 'resource' || n.data?.type === 'data'),
        );
        if (moduleResource) {
          newTarget = moduleResource.id;
        }
      }

      return {
        ...edge,
        source: newSource,
        target: newTarget,
      };
    });
  }, []);

  const onLayout = useCallback(
    async (rawNodes?: any[], rawEdges?: any[]) => {
      // Fallback if called without args (legacy effect)
      const nodesToLayout = rawNodes || nodes;
      let edgesToLayout = rawEdges || edges;

      if (nodesToLayout.length === 0) return;

      // Remap invalid edges before layout
      edgesToLayout = remapInvalidEdges(nodesToLayout, edgesToLayout);

      const layoutedNodes = await getLayoutedElements(nodesToLayout, edgesToLayout);

      setNodes(layoutedNodes);
      setEdges(edgesToLayout);

      setTimeout(() => {
        fitView({ padding: 0.2, duration: 800 });
      }, 100);
    },
    [nodes, edges, fitView, setNodes, setEdges, remapInvalidEdges],
  );

  // Fetch data on mount
  React.useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // 0. Prop Data
    if (initialData) {
      onLayout(initialData.nodes, initialData.edges);
      setLoadingError(null);
      return;
    }

    // Check URL params for data source
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    let base64Data = hashParams.get('base64data');

    const searchParams = new URLSearchParams(window.location.search);
    if (!base64Data) {
      base64Data = searchParams.get('base64data');
    }

    // 1. Prop URL or Query Param
    const dataFile = dataUrl || searchParams.get('file');
    const themeParam = searchParams.get('theme') || hashParams.get('theme');

    if (themeParam && (themeParam === 'light' || themeParam === 'dark')) {
      setTheme(themeParam);
    } else {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        setTheme('light');
      }
    }

    if (base64Data) {
      try {
        const jsonString = atob(base64Data);
        const data = JSON.parse(jsonString);
        onLayout(data.nodes, data.edges);
        setLoadingError(null);

        if (window.history && window.history.replaceState) {
          const cleanUrl = window.location.pathname + window.location.search;
          window.history.replaceState(null, '', cleanUrl);
        }
        return;
      } catch (e) {
        console.error('Failed to decode base64 data:', e);
        setLoadingError('Failed to parse base64 data. Ensure it is valid JSON encoded in base64.');
        return;
      }
    }

    if (!dataFile) {
      // Fallback or just ignore if used as component without data source yet
      // setLoadingError("No data source provided.");
      return;
    }

    const doFetch = fetcher || fetch;

    doFetch(dataFile)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        onLayout(data.nodes, data.edges);
        setLoadingError(null);
      })
      .catch((err) => {
        console.error('Failed to load data:', err);
        setLoadingError(`Failed to load: ${(err as Error).message}`);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLayout, dataUrl, initialData]);

  // Helper to check if edge is connected to node
  const isConnected = (edge: any, nodeId: string) => {
    return edge.source === nodeId || edge.target === nodeId;
  };

  const handleFocusNode = (nodeId: string) => {
    fitView({
      nodes: [{ id: nodeId }],
      duration: 800,
      padding: 0.5,
      maxZoom: 1.2,
    });
  };

  const onNodeClick = (_event: any, node: any) => {
    if (node.type === 'group') return;

    if (node.id === highlightId) {
      setHighlightId(null);
      setHistory([]);
    } else {
      if (highlightId) setHistory((prev) => [...prev, highlightId]);
      setHighlightId(node.id);
      handleFocusNode(node.id);
    }
  };

  const onPaneClick = () => {
    setHighlightId(null);
    setHistory([]);
  };

  // Calculate slots for edges to prevent label overlap
  const edgeSlots = React.useMemo(() => {
    if (!highlightId) return {};
    const slots: any = {};

    const connected = edges.filter((e) => isConnected(e, highlightId));

    // Group by direction
    const outgoing = connected.filter((e) => e.source === highlightId);
    const incoming = connected.filter((e) => e.target === highlightId);

    // Sort for determinism
    outgoing.sort((a, b) => a.target.localeCompare(b.target));
    incoming.sort((a, b) => a.source.localeCompare(b.source));

    outgoing.forEach((e, i) => {
      slots[e.id] = { index: i, total: outgoing.length, side: 'source' };
    });
    incoming.forEach((e, i) => {
      slots[e.id] = { index: i, total: incoming.length, side: 'target' };
    });

    return slots;
  }, [highlightId, edges]);

  const selectedNode = highlightId ? nodes.find((n) => n.id === highlightId) : null;

  const handleSelectNode = (nodeId: string) => {
    if (highlightId) setHistory((prev) => [...prev, highlightId]);
    setHighlightId(nodeId);
    handleFocusNode(nodeId);
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const prevId = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setHighlightId(prevId);
    handleFocusNode(prevId);
  };

  const upstreamNodes = selectedNode
    ? edges
        .filter((e) => e.target === selectedNode.id)
        .map((e) => nodes.find((n) => n.id === e.source))
        .filter(Boolean)
    : [];
  const downstreamNodes = selectedNode
    ? edges
        .filter((e) => e.source === selectedNode.id)
        .map((e) => nodes.find((n) => n.id === e.target))
        .filter(Boolean)
    : [];

  // Custom styling for nodes based on Terraform Action
  const styledNodes = nodes.map((node) => {
    const isDimmed =
      highlightId &&
      node.id !== highlightId &&
      !edges.some(
        (e) =>
          (e.source === highlightId && e.target === node.id) ||
          (e.target === highlightId && e.source === node.id),
      );

    // Groups are never dimmed, they just sit in background
    if (node.type === 'group') {
      return {
        ...node,
        style: {
          ...node.style,
          pointerEvents: 'none',
          color: currentTheme.groupLabel,
        },
      };
    }

    const action = node.data.action;
    const isData = node.data.type === 'Data' || node.data.type === 'data';
    const count = node.data.count as number | undefined;

    let borderColor = currentTheme.nodeBorder;
    let backgroundColor = currentTheme.nodeBg;

    if (action?.includes('create') && action?.includes('delete')) {
      borderColor = currentTheme.groupLabel; // Use blue/prominent color for replace or keep update? Let's use Update for warning
      borderColor = currentTheme.nodeActionUpdate;
      backgroundColor = `linear-gradient(135deg, ${currentTheme.nodeActionDeleteBg} 50%, ${currentTheme.nodeActionCreateBg} 50%)`;
    } else if (action?.includes('create')) {
      borderColor = currentTheme.nodeActionCreate;
      backgroundColor = currentTheme.nodeActionCreateBg;
    } else if (action?.includes('update')) {
      borderColor = currentTheme.nodeActionUpdate;
      backgroundColor = currentTheme.nodeActionUpdateBg;
    } else if (action?.includes('delete')) {
      borderColor = currentTheme.nodeActionDelete;
      backgroundColor = currentTheme.nodeActionDeleteBg;
    }

    // Override for Data sources
    if (isData) {
      borderColor = currentTheme.nodeDataBorder;
      backgroundColor = currentTheme.nodeDataBg;
    }

    return {
      ...node,
      style: {
        background: backgroundColor,
        color: currentTheme.nodeColor,
        border: `2px solid ${borderColor}`,
        borderRadius: '6px',
        padding: '10px',
        fontSize: '11px',
        width: 180,
        opacity: isDimmed ? 0.2 : 1, // Dim unconnected nodes
        transition: 'opacity 0.2s',
        cursor: 'pointer',
        boxShadow:
          count && count > 1
            ? `3px 3px 0 0 ${borderColor}66, 6px 6px 0 0 ${borderColor}33`
            : 'none',
      },
      data: {
        ...node.data,
        label: (
          <div className="flex flex-col relative" title={node.data.label}>
            <div className="flex justify-between items-start">
              <span className="text-[9px] uppercase opacity-60">{node.data.type}</span>
              {count && count > 1 && (
                <span
                  className="bg-gray-700 text-[9px] px-1.5 rounded text-white font-mono border border-gray-600"
                  title={`Count: ${count}`}
                >
                  x{count}
                </span>
              )}
            </div>
            <span className="font-bold truncate">
              {node.data.label.split('.').slice(-2).join('.')}
            </span>
            <span className="mt-2 text-[8px] opacity-70 italic">Action: {action}</span>
          </div>
        ),
      },
    };
  });

  // Style edges based on highlight
  const styledEdges = edges.map((edge) => {
    const isRelevant = !highlightId || isConnected(edge, highlightId);
    const slot = edgeSlots[edge.id];

    return {
      ...edge,
      type: 'attribute', // Use our custom edge
      data: {
        ...edge.data,
        attributes: edge.attributes || [], // Ensure attributes are passed
        highlightId: highlightId,
        sourceId: edge.source,
        targetId: edge.target,
        slot: slot,
        theme: currentTheme, // Pass theme to edge
      },
      style: {
        ...edge.style,
        stroke: isRelevant ? currentTheme.edge : currentTheme.edgeDim,
        strokeWidth: isRelevant ? 2 : 1,
        opacity: isRelevant ? 1 : 0.1,
        pointerEvents: 'none', // Ensure edges don't block canvas dragging
      },
      animated: isRelevant && !!highlightId,
    };
  });

  const startResizing = React.useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    isResizingRef.current = true;
  }, []);

  const stopResizing = React.useCallback(() => {
    isResizingRef.current = false;
  }, []);

  const resize = React.useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizingRef.current) {
      const newWidth = window.innerWidth - mouseMoveEvent.clientX;
      if (newWidth > 250 && newWidth < 800) {
        // Min 250px, Max 800px
        setPanelWidth(newWidth);
      }
    }
  }, []);

  React.useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        minZoom={0.1}
        maxZoom={4}
        style={{ backgroundColor: currentTheme.bg }}
      >
        <Background
          color={currentTheme.grid}
          variant={BackgroundVariant.Lines}
          gap={20}
          size={currentTheme.gridThickness}
        />

        {loadingError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <div
              className={`pointer-events-auto p-6 rounded-lg shadow-2xl border ${currentTheme.panelBorder} ${currentTheme.panelBg} ${currentTheme.panelText} max-w-md text-center`}
            >
              <h2 className="text-xl font-bold mb-2 text-red-500">Data Loading Error</h2>
              <p className="mb-4">{loadingError}</p>
            </div>
          </div>
        )}

        <div className="absolute top-0 left-0 w-full p-4 pointer-events-none flex justify-between items-start">
          <Panel
            position="top-left"
            className={`${currentTheme.panelBg} p-4 rounded-lg border ${currentTheme.panelBorder} ${currentTheme.panelText} shadow-xl pointer-events-auto`}
          >
            <h1 className="text-lg font-bold mb-1">InfraWeave TF Browser</h1>
            <div className="flex justify-between items-center mb-1">
              <p className={`text-xs ${currentTheme.panelTextDim}`}>
                Hierarchical Dependency Graph
              </p>
              <div
                className={`text-[9px] font-mono px-2 py-0.5 ml-4 rounded-full flex gap-2 ${
                  theme === 'dark'
                    ? 'bg-gray-800 border border-gray-700'
                    : 'bg-gray-100 border border-gray-200'
                }`}
              >
                <span
                  className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}
                  title="Resources and data blocks (excludes variables and outputs)"
                >
                  <b>{stats.nodes}</b> blocks
                </span>
                <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>|</span>
                <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                  <b>{stats.edges}</b> dependencies
                </span>
              </div>
            </div>
            <div className="mt-3 flex gap-3 text-[10px]">
              <span className="flex items-center gap-1">
                <i
                  className="w-2 h-2 rounded-full"
                  style={{ background: currentTheme.nodeActionCreate }}
                />{' '}
                Create
              </span>
              <span className="flex items-center gap-1">
                <i
                  className="w-2 h-2 rounded-full"
                  style={{ background: currentTheme.nodeActionUpdate }}
                />{' '}
                Update
              </span>
              <span className="flex items-center gap-1">
                <i
                  className="w-2 h-2 rounded-full"
                  style={{ background: currentTheme.nodeActionDelete }}
                />{' '}
                Delete
              </span>
              <span className="flex items-center gap-1">
                <i
                  className="w-2 h-2 rounded-full"
                  style={{ background: currentTheme.nodeDataBorder }}
                />{' '}
                Data
              </span>
            </div>
          </Panel>

          {selectedNode && (
            <Panel
              position="top-right"
              className={`${currentTheme.panelBg} rounded-l-lg border-l border-b border-t ${currentTheme.panelBorder} ${currentTheme.panelText} shadow-xl pointer-events-auto max-h-[90vh] flex flex-col`}
              style={{
                width: panelWidth,
                transition: isResizingRef.current ? 'none' : 'width 0.1s ease',
                margin: 0,
                marginTop: 10,
                marginRight: 10,
                height: 'auto',
                borderRadius: '8px',
              }}
            >
              {/* Drag Handle */}
              <div
                onMouseDown={startResizing}
                className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/30 opacity-0 hover:opacity-100 transition-opacity z-50 rounded-l-lg"
                style={{ left: '-4px', width: '12px' }} // Wider hit area, positioned to overlap border
              />

              <div className="p-4 pb-0 flex flex-col gap-4 flex-none">
                {history.length > 0 && (
                  <div className="flex justify-start">
                    <button
                      onClick={handleBack}
                      className={`text-[11px] font-bold ${
                        theme === 'dark'
                          ? 'bg-gray-800 hover:bg-gray-700'
                          : 'bg-gray-100 hover:bg-gray-200'
                      } border ${
                        theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                      } px-2 py-1 rounded flex items-center gap-2 transition text-blue-400 hover:text-blue-300`}
                    >
                      <span>←</span> Back
                    </button>
                  </div>
                )}

                {/* Header for the selected node */}
                <div
                  className={`flex items-center justify-between gap-2 border-b ${currentTheme.panelBorder} pb-3`}
                >
                  <div className="flex flex-col overflow-hidden">
                    <span className={`text-[10px] ${currentTheme.panelTextDim} uppercase`}>
                      {selectedNode.data.type}
                    </span>
                    <span
                      className="font-mono text-xs font-bold truncate text-yellow-500"
                      title={selectedNode.data.label}
                    >
                      {selectedNode.data.label}
                    </span>
                  </div>
                  <button
                    onClick={() => handleFocusNode(selectedNode.id)}
                    className={`p-1.5 ${currentTheme.panelTextDim} hover:${
                      currentTheme.panelText
                    } ${
                      theme === 'dark'
                        ? 'bg-gray-800 hover:bg-gray-700'
                        : 'bg-gray-100 hover:bg-gray-200'
                    } border ${
                      theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                    } rounded transition`}
                    title="Center View on Node"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="1" />
                      <line x1="12" y1="2" x2="12" y2="22" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
                {/* Inputs & Outputs */}
                {(upstreamNodes.length > 0 || downstreamNodes.length > 0) && (
                  <div className="flex flex-col gap-3">
                    {upstreamNodes.length > 0 && (
                      <div>
                        <h3
                          className={`text-xs font-semibold ${currentTheme.panelTextDim} mb-1 flex items-center gap-2`}
                        >
                          Depends On
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono ${
                              theme === 'dark'
                                ? 'bg-blue-900/50 text-blue-300'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {upstreamNodes.length}
                          </span>
                        </h3>
                        <div className="flex flex-col gap-1">
                          {upstreamNodes.map((n: any) => (
                            <div
                              key={n.id}
                              className={`flex items-center justify-between gap-1 ${
                                theme === 'dark'
                                  ? 'bg-gray-800 hover:bg-gray-750 border-gray-700'
                                  : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                              } p-1 rounded border transition`}
                            >
                              <button
                                onClick={() => handleFocusNode(n.id)}
                                className="flex-1 text-left text-[11px] font-mono hover:text-blue-400 truncate px-1"
                                title="Animate to node"
                              >
                                {n.data.label}
                              </button>
                              <button
                                onClick={() => handleSelectNode(n.id)}
                                className={`p-1 ${currentTheme.panelTextDim} hover:${
                                  currentTheme.panelText
                                } rounded hover:${
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                                }`}
                                title="Select Details"
                              >
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                  <polyline points="12 5 19 12 12 19" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {downstreamNodes.length > 0 && (
                      <div>
                        <h3
                          className={`text-xs font-semibold ${currentTheme.panelTextDim} mb-1 flex items-center gap-2`}
                        >
                          Referenced By
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono ${
                              theme === 'dark'
                                ? 'bg-purple-900/50 text-purple-300'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {downstreamNodes.length}
                          </span>
                        </h3>
                        <div className="flex flex-col gap-1">
                          {downstreamNodes.map((n: any) => (
                            <div
                              key={n.id}
                              className={`flex items-center justify-between gap-1 ${
                                theme === 'dark'
                                  ? 'bg-gray-800 hover:bg-gray-750 border-gray-700'
                                  : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                              } p-1 rounded border transition`}
                            >
                              <button
                                onClick={() => handleFocusNode(n.id)}
                                className="flex-1 text-left text-[11px] font-mono hover:text-blue-400 truncate px-1"
                                title="Animate to node"
                              >
                                {n.data.label}
                              </button>
                              <button
                                onClick={() => handleSelectNode(n.id)}
                                className={`p-1 ${currentTheme.panelTextDim} hover:${
                                  currentTheme.panelText
                                } rounded hover:${
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                                }`}
                                title="Select Details"
                              >
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                  <polyline points="12 5 19 12 12 19" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {selectedNode.data.hcl && (
                  <HclViewer
                    code={selectedNode.data.hcl as string}
                    theme={theme}
                    currentTheme={currentTheme}
                  />
                )}
                {selectedNode.data.values && (
                  <div className={`mt-4 border-t ${currentTheme.panelBorder} pt-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-bold">Node Values</h2>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setHideNulls(!hideNulls)}
                          className={`p-1 rounded transition ${
                            hideNulls
                              ? theme === 'dark'
                                ? 'text-blue-400 bg-blue-900/30'
                                : 'text-blue-600 bg-blue-100'
                              : `${currentTheme.panelTextDim} hover:${currentTheme.panelText}`
                          }`}
                          title={hideNulls ? 'Show nulls' : 'Filter nulls'}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="4.93" y1="19.07" x2="19.07" y2="4.93" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setHideSensitive(!hideSensitive)}
                          className={`p-1 rounded transition ${
                            hideSensitive
                              ? theme === 'dark'
                                ? 'text-blue-400 bg-blue-900/30'
                                : 'text-blue-600 bg-blue-100'
                              : `${currentTheme.panelTextDim} hover:${currentTheme.panelText}`
                          }`}
                          title={hideSensitive ? 'Disable Filter' : 'Filter unknowns'}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div
                      className={`text-[10px] ${
                        theme === 'dark' ? 'bg-black' : 'bg-gray-50 border border-gray-200'
                      } p-2 pr-8 rounded overflow-x-auto`}
                    >
                      <ReactJson
                        src={
                          hideSensitive || hideNulls
                            ? filterValues(selectedNode.data.values, {
                                hideNulls,
                                hideUnknowns: hideSensitive,
                              }) || {}
                            : (selectedNode.data.values as object)
                        }
                        theme={theme === 'dark' ? 'ocean' : 'rjv-default'}
                        name={false}
                        displayDataTypes={false}
                        collapsed={2}
                        enableClipboard
                        style={{ backgroundColor: 'transparent', fontSize: '10px' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>

        {/* Watermark moved to bottom-left to avoid React Flow overlap */}
        <div className="absolute bottom-8 left-8 pointer-events-none select-none z-0">
          <h1
            className={`text-4xl font-black tracking-tighter ${currentTheme.panelText}`}
            style={{ opacity: 0.05 }}
          >
            InfraWeave
          </h1>
        </div>
      </ReactFlow>
    </div>
  );
}

export const TerraformFlow = (props: TerraformFlowProps) => (
  <ReactFlowProvider>
    <TerraformFlowContent {...props} />
  </ReactFlowProvider>
);

export default TerraformFlow;
