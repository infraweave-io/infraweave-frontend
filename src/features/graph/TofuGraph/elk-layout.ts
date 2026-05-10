import ELK from 'elkjs/lib/elk.bundled.js';
import { Node, Edge } from '@xyflow/react';

const elk = new ELK();

const buildElkHierarchy = (nodes: any[], edges: any[]) => {
  const isLargeGraph = nodes.length > 50;

  const hierarchy: any = {};
  const idToParent: any = {};
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // 1. Initialize map and hierarchy
  nodes.forEach((node) => {
    // Validate Parent: If parentId is specified but doesn't exist, warn and treat as root
    let parentId = node.parentId;
    if (parentId) {
      if (!nodeMap.has(parentId)) {
        console.error(
          `[Data Error] Node '${node.id}' references parent '${parentId}' which does NOT exist in the node list.`,
        );
        // Debugging aid: check for whitespace mismatches
        const fuzzyMatch = nodes.find((n) => n.id.trim() === parentId.trim());
        if (fuzzyMatch) {
          console.error(
            `  -> Found fuzzy match: '${fuzzyMatch.id}'. Check for leading/trailing spaces in JSON.`,
          );
        }
        parentId = undefined; // Fallback to root to allow rendering
      }
    }

    idToParent[node.id] = parentId || 'root';
    hierarchy[node.id] = {
      id: node.id,
      children: [],
      edges: [],
      // Dimensions: Groups get modest dimensions to start, allowing them to grow
      width: node.type === 'group' ? 100 : 170,
      height: node.type === 'group' ? 100 : 70,
      layoutOptions:
        node.type === 'group'
          ? {
              'elk.algorithm': 'layered',
              'elk.direction': 'DOWN',
              'elk.aspectRatio': '2.0', // Try to keep groups from getting too wide
              'elk.padding': isLargeGraph
                ? '[top=40,left=20,bottom=20,right=20]'
                : '[top=50,left=30,bottom=30,right=30]', // Increased top padding for title
              'elk.spacing.nodeNode': isLargeGraph ? '15' : '30',
              'elk.resize.textLabels': 'true', // Helps with autosizing
              'elk.insideSelfLoops.activate': 'true',
            }
          : undefined,
    };
  });

  // 2. Build the tree structure
  const rootChildren: any[] = [];
  nodes.forEach((node) => {
    const parentId = idToParent[node.id];
    // parentId is either a valid ID (checked above) or 'root'
    if (parentId !== 'root' && hierarchy[parentId]) {
      hierarchy[parentId].children.push(hierarchy[node.id]);
    } else {
      rootChildren.push(hierarchy[node.id]);
    }
  });

  // 3. Assign edges to the correct Common Ancestor (LCA)
  const findLCA = (id1: string, id2: string) => {
    const path1 = new Set();
    let curr = id1;
    // Safety counter to prevent infinite loops in cyclic graphs
    let depth = 0;
    while (curr && curr !== 'root' && depth < 1000) {
      path1.add(curr);
      curr = idToParent[curr];
      depth++;
    }
    path1.add('root');

    let curr2 = id2;
    depth = 0;
    while (curr2 && curr2 !== 'root' && depth < 1000) {
      if (path1.has(curr2)) return curr2;
      if (path1.has(idToParent[curr2])) return idToParent[curr2];
      curr2 = idToParent[curr2];
      depth++;
    }
    return 'root';
  };

  const rootEdges: any[] = [];

  edges.forEach((edge) => {
    // Validate Edge: Sources and Targets MUST exist
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
      console.warn(
        `Skipping invalid edge ${edge.id}: source or target missing (${edge.source} -> ${edge.target})`,
      );
      return;
    }

    const lca = findLCA(edge.source, edge.target);

    let containerId = lca;
    if (containerId === edge.source || containerId === edge.target) {
      containerId = idToParent[containerId];
    }

    // Construct ELK edge
    const elkEdge = {
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    };

    if (containerId === 'root' || !hierarchy[containerId]) {
      rootEdges.push(elkEdge);
    } else {
      hierarchy[containerId].edges.push(elkEdge);
    }
  });

  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.aspectRatio': '1.5', // Prefer a slightly wider than square layout, but constrain it
      'elk.spacing.nodeNode': isLargeGraph ? '20' : '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': isLargeGraph ? '40' : '80',
      'elk.padding': isLargeGraph
        ? '[top=20,left=20,bottom=20,right=20]'
        : '[top=50,left=50,bottom=50,right=50]',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
    children: rootChildren,
    edges: rootEdges,
  };
};

export const getLayoutedElements = async (nodes: Node[], edges: Edge[]) => {
  try {
    const graph = buildElkHierarchy(nodes, edges);
    const layoutedGraph: any = await elk.layout(graph);

    // Flatten the result to update React Flow nodes
    const layoutedNodes: Node[] = [];

    // Recursive function to extract coordinates and convert to absolute positions
    // We strip 'parentId' to prevent React Flow from crashing if a parent is technically missing from the render list
    // despite being in the layout tree. This makes the renderer robust against "Parent node not found" errors.
    const processNode = (elkNode: any, parentX = 0, parentY = 0) => {
      const originalNode = nodes.find((n) => n.id === elkNode.id);

      // Calculate absolute position based on parent's absolute position
      const currentX = parentX + (elkNode.x || 0);
      const currentY = parentY + (elkNode.y || 0);

      if (originalNode) {
        layoutedNodes.push({
          ...originalNode,
          // Use absolute coordinates
          position: { x: currentX, y: currentY },
          // Remove structural parent dependency for rendering
          parentId: undefined,
          extent: undefined,
          style:
            originalNode.type === 'group'
              ? {
                  ...originalNode.style,
                  width: elkNode.width,
                  height: elkNode.height,
                }
              : originalNode.style,
        });
      }

      if (elkNode.children) {
        elkNode.children.forEach((child: any) => processNode(child, currentX, currentY));
      }
    };

    // Start processing from the root.
    // The root node itself isn't a React Flow node, so we just process its children.
    if (layoutedGraph.children) {
      layoutedGraph.children.forEach((child: any) =>
        processNode(child, layoutedGraph.x || 0, layoutedGraph.y || 0),
      );
    }

    return layoutedNodes;
  } catch (error) {
    console.error('ELK Layout finished with error:', error);
    return nodes; // Return original nodes if layout fails to avoid crash
  }
};
