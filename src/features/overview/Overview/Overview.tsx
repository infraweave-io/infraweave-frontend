import React from 'react';
import { Box, Button } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { PageHeading } from '../../../shared/components/PageHeading';
import { WidgetContainer } from '../../widgets/WidgetContainer';
import { OVERVIEW_WIDGETS } from './overviewWidgets';
import { useOverviewLayout } from './useOverviewLayout';

/** Landing content for the Overview tab: widgets the user can rearrange, add and remove. */
export const Overview = () => {
  const [editing, setEditing] = React.useState(false);
  const { layout, setLayout, resetLayout } = useOverviewLayout();

  return (
    <>
      <PageHeading
        title="Overview"
        description="Infrastructure managed through InfraWeave across every connected cloud account."
        actions={
          editing ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={resetLayout}>Reset to default</Button>
              <Button variant="contained" onClick={() => setEditing(false)}>
                Done
              </Button>
            </Box>
          ) : (
            <Button startIcon={<EditIcon />} onClick={() => setEditing(true)}>
              Customize
            </Button>
          )
        }
      />
      <WidgetContainer
        widgets={OVERVIEW_WIDGETS}
        layout={layout}
        onLayoutChange={setLayout}
        editing={editing}
      />
    </>
  );
};
