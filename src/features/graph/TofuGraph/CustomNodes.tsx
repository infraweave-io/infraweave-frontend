import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';

// Custom Edge with Smart Attribute Labels
export const AttributeEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: any) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Determine visibility and position based on selection
  const edgeStyle = { ...style, pointerEvents: 'none' };

  if (!data || !data.highlightId || !data.attributes || data.attributes.length === 0) {
    return <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={edgeStyle} />;
  }

  const isSourceFn = data.highlightId === data.sourceId;
  const isTargetFn = data.highlightId === data.targetId;

  if (!isSourceFn && !isTargetFn) {
    return <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={edgeStyle} />;
  }

  const theme = data.theme || {};

  // Calculate t position to spread labels and avoid overlaps
  let t = isSourceFn ? 0.15 : 0.85;

  if (data.slot && data.slot.total > 1) {
    // Spread labels over a range (e.g., 10% to 30%)
    const range = 0.2;
    const start = isSourceFn ? 0.1 : 0.7;
    const step = range / (data.slot.total - 1 || 1);
    t = start + step * data.slot.index;
  }

  const labelX = sourceX + (targetX - sourceX) * t;
  const labelY = sourceY + (targetY - sourceY) * t;

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'none', // Ensure label wrapper doesn't capture events
            zIndex: 10,
          }}
          className="nodrag nopan"
        >
          <div
            style={{
              borderColor: theme.nodeBorder,
              color: theme.nodeColor,
              // Add slight opacity to bg if needed, or use specific vars
              backgroundColor:
                theme.bg === '#ffffff' ? 'rgba(255,255,255,0.95)' : 'rgba(13,17,23,0.95)',
            }}
            className="border px-1.5 py-0.5 rounded text-[8px] font-mono font-bold shadow-sm whitespace-nowrap"
          >
            {data.attributes.join(', ')}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

// Custom Node for Groups (Modules)
export const GroupNode = ({ data, style = {} }: any) => {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          padding: '5px',
          color: style.color || '#388bfd',
          fontWeight: 'bold',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}
      >
        {data.label}
      </div>
    </div>
  );
};
