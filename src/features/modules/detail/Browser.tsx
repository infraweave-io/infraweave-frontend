import * as React from 'react';
import clsx from 'clsx';
import { styled, alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Refresh from '@mui/icons-material/Refresh';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import { treeItemClasses } from '@mui/x-tree-view/TreeItem';
import { useTreeItem2, UseTreeItem2Parameters } from '@mui/x-tree-view/useTreeItem2';
import {
  TreeItem2Checkbox,
  TreeItem2Content,
  TreeItem2IconContainer,
  TreeItem2Label,
  TreeItem2Root,
} from '@mui/x-tree-view/TreeItem2';
import { TreeItem2Icon } from '@mui/x-tree-view/TreeItem2Icon';
import { TreeItem2Provider } from '@mui/x-tree-view/TreeItem2Provider';
import { TreeItem2DragAndDropOverlay } from '@mui/x-tree-view/TreeItem2DragAndDropOverlay';
import { TreeViewBaseItem } from '@mui/x-tree-view/models';

type ExtendedTreeItemProps = {
  fileType?: FileType;
  id: string;
  label: string;
};

type FileType = 'image' | 'pdf' | 'doc' | 'video' | 'folder' | 'pinned' | 'trash';

declare module 'react' {
  interface CSSProperties {
    '--tree-view-color'?: string;
    '--tree-view-bg-color'?: string;
  }
}

const StyledTreeItemRoot = styled(TreeItem2Root)(({ theme }) => ({
  color: theme.palette.grey[400],
  position: 'relative',
  [`& .${treeItemClasses.groupTransition}`]: {
    marginLeft: theme.spacing(3.5),
  },
  ...theme.applyStyles('light', {
    color: theme.palette.grey[800],
  }),
})) as unknown as typeof TreeItem2Root;

const CustomTreeItemContent = styled(TreeItem2Content)(({ theme }) => ({
  flexDirection: 'row-reverse',
  borderRadius: theme.spacing(0.7),
  marginBottom: theme.spacing(0.5),
  marginTop: theme.spacing(0.5),
  padding: theme.spacing(0.5),
  paddingRight: theme.spacing(1),
  fontWeight: 500,
  [`&.Mui-expanded `]: {
    '&:not(.Mui-focused, .Mui-selected, .Mui-selected.Mui-focused) .labelIcon': {
      color: theme.palette.primary.dark,
      ...theme.applyStyles('light', {
        color: theme.palette.primary.main,
      }),
    },
    '&::before': {
      content: '""',
      display: 'block',
      position: 'absolute',
      left: '16px',
      top: '44px',
      height: 'calc(100% - 48px)',
      width: '1.5px',
      backgroundColor: theme.palette.grey[700],
      ...theme.applyStyles('light', {
        backgroundColor: theme.palette.grey[300],
      }),
    },
  },
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
    color: 'white',
    ...theme.applyStyles('light', {
      color: theme.palette.primary.main,
    }),
  },
  [`&.Mui-focused, &.Mui-selected, &.Mui-selected.Mui-focused`]: {
    backgroundColor: theme.palette.primary.dark,
    color: theme.palette.primary.contrastText,
    ...theme.applyStyles('light', {
      backgroundColor: theme.palette.primary.main,
    }),
  },
}));

const StyledTreeItemLabelText = styled(Typography)({
  color: 'inherit',
  fontFamily: 'General Sans',
  fontWeight: 500,
}) as unknown as typeof Typography;

interface CustomLabelProps {
  children: React.ReactNode;
  icon?: React.ElementType;
  expandable?: boolean;
}

function CustomLabel({
  icon: Icon,
  expandable: _expandable,
  children,
  ...other
}: CustomLabelProps) {
  return (
    <TreeItem2Label
      {...other}
      sx={{
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {Icon && (
        <Box
          component={Icon}
          className="labelIcon"
          color="inherit"
          sx={{ mr: 1, fontSize: '1.2rem' }}
        />
      )}

      <StyledTreeItemLabelText variant="body2">{children}</StyledTreeItemLabelText>
    </TreeItem2Label>
  );
}

const isExpandable = (reactChildren: React.ReactNode) => {
  if (Array.isArray(reactChildren)) {
    return reactChildren.length > 0 && reactChildren.some(isExpandable);
  }
  return Boolean(reactChildren);
};

const getIconFromFileType = (fileType: FileType) => {
  switch (fileType) {
    case 'image':
      return Refresh;
    default:
      return Refresh;
  }
};

interface CustomTreeItemProps
  extends Omit<UseTreeItem2Parameters, 'rootRef'>,
    Omit<React.HTMLAttributes<HTMLLIElement>, 'onFocus'> {}

const CustomTreeItem = React.forwardRef(function CustomTreeItem(
  props: CustomTreeItemProps,
  ref: React.Ref<HTMLLIElement>,
) {
  const { id, itemId, label, disabled, children, ...other } = props;

  const {
    getRootProps,
    getContentProps,
    getIconContainerProps,
    getCheckboxProps,
    getLabelProps,
    getDragAndDropOverlayProps,
    status,
    publicAPI,
  } = useTreeItem2({ id, itemId, children, label, disabled, rootRef: ref });

  const item = publicAPI.getItem(itemId);
  const expandable = isExpandable(children);
  let icon;
  if (expandable) {
    icon = Refresh;
  } else if (item.fileType) {
    icon = getIconFromFileType(item.fileType);
  }

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
          <TreeItem2Checkbox {...getCheckboxProps()} />
          <CustomLabel {...getLabelProps({ icon, expandable: expandable && status.expanded })}>
            {label}
          </CustomLabel>
          <TreeItem2DragAndDropOverlay {...getDragAndDropOverlayProps()} />
        </CustomTreeItemContent>
        {children}
      </StyledTreeItemRoot>
    </TreeItem2Provider>
  );
});

const data = [
  {
    PK: 'DEPLOYMENT#my-k8s-cluster-1/default::bucketcollection/my-bucketcollection',
    SK: 'METADATA',
    deleted: 0,
    deleted_PK: '0|DEPLOYMENT#my-k8s-cluster-1/default::bucketcollection/my-bucketcollection',
    dependencies: [],
    deployment_id: 'bucketcollection/my-bucketcollection',
    environment: 'my-k8s-cluster-1/default',
    epoch: 1729837232441,
    error_text: '',
    job_id: '55add7f04cff4eaa9a6381bf4ce3d4d9',
    module: 'bucketcollection',
    module_type: 'stack',
    module_version: '0.0.14',
    output: {
      bucket_1a__bucket_arn: {
        sensitive: false,
        type: 'string',
        value: 'arn:aws:s3:::my-bucketcollection123456',
      },
      bucket_1a__region: {
        sensitive: false,
        type: 'string',
        value: 'eu-central-1',
      },
      bucket_1a__sse_algorithm: {
        sensitive: false,
        type: 'string',
        value: 'my-bucketcollection123456.s3.amazonaws.com',
      },
      bucket_1a__tags: {
        sensitive: false,
        type: ['map', 'string'],
        value: {
          Environment43: 'dev',
          Name234: 'my-s3bucket-bucket1a',
        },
      },
      bucket_2__bucket_arn: {
        sensitive: false,
        type: 'string',
        value: 'arn:aws:s3:::my-bucketcollection123456-after',
      },
      bucket_2__region: {
        sensitive: false,
        type: 'string',
        value: 'eu-central-1',
      },
      bucket_2__sse_algorithm: {
        sensitive: false,
        type: 'string',
        value: 'my-bucketcollection123456-after.s3.amazonaws.com',
      },
      bucket_2__tags: {
        sensitive: false,
        type: ['map', 'string'],
        value: {
          Environment43: 'dev',
          Name234: 'my-s3bucket',
          PreviousBucket: 'arn:aws:s3:::my-bucketcollection123456',
          Tjoho: 'This is cool',
        },
      },
    },
    policy_results: [
      {
        description:
          "# Allowed Regions\nThere are a set of regions that are allowed to be used, since these are the regions that the company has a presence in.\n\n## Best practices\n- Use the allowed regions to ensure that the company's data is stored in the regions where the company has a presence.\n\n## Questions\nIf you need to use a region that is not in the list, please [reach out](mailto:security@acmecorp.com) to the security team\n",
        environment: 'dev',
        failed: false,
        policy: 'allowed-regions',
        policy_name: 'AllowedRegions',
        version: '0.1.2',
        violations: {},
      },
      {
        description:
          '# Allowed Naming Formats\nChecks if the S3 bucket name follows the naming convention.\nIt should start with dev- or prod-\n\n## Reasons\n- To maintain consistency in naming\n- To easily identify the environment\n\n## Best practices\n- Use a prefix to identify the environment\n',
        environment: 'dev',
        failed: false,
        policy: 's3-naming-format',
        policy_name: 'NamingFormat',
        version: '0.0.3',
        violations: {},
      },
    ],
    status: 'successful',
    variables: {
      bucket_1a__bucket_name: 'my-bucketcollection123456',
    },
  },
];

function processObject(obj: any, parentId: string): TreeViewBaseItem<ExtendedTreeItemProps>[] {
  const items: TreeViewBaseItem<ExtendedTreeItemProps>[] = [];
  let index = 0;
  for (const [key, value] of Object.entries(obj)) {
    const id = `${parentId}_${index}`;
    let children: TreeViewBaseItem<ExtendedTreeItemProps>[] | undefined;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      children = processObject(value, id);
    } else if (Array.isArray(value)) {
      children = value.map((item, idx) => {
        if (typeof item === 'object' && item !== null) {
          return {
            id: `${id}_${idx}`,
            label: `${idx}`,
            children: processObject(item, `${id}_${idx}`),
          };
        }
        return {
          id: `${id}_${idx}`,
          label: String(item),
        };
      });
    } else {
      children = [
        {
          id: `${id}_value`,
          label: String(value),
        },
      ];
    }

    items.push({
      id,
      label: key,
      children: children.length > 0 ? children : undefined,
    });
    index++;
  }
  return items;
}

const variablesItems = processObject(data[0].variables, 'variables');
const outputItems = processObject(data[0].output, 'output');

const ITEMS: TreeViewBaseItem<ExtendedTreeItemProps>[] = [
  {
    id: 'variables',
    label: 'Variables',
    children: variablesItems,
  },
  {
    id: 'output',
    label: 'Output',
    children: outputItems,
  },
];

export default function DataTreeView() {
  return (
    <RichTreeView
      items={ITEMS}
      defaultExpandedItems={['variables', 'output']}
      sx={{ height: 'fit-content', flexGrow: 1, maxWidth: 600, overflowY: 'auto' }}
      slots={{ item: CustomTreeItem }}
    />
  );
}
