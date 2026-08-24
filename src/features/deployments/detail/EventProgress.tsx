import * as React from 'react';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import { Event } from '../../../types/Event';

const steps = ['Requested', 'Initiated', 'Policy Evaluation', 'Running', 'Finished'];

/**
 * Palette token for a job type. Replaces the CSS named colours (darkGreen,
 * darkBlue, darkRed) these used to carry, which never adapted to dark mode.
 */
const EVENT_TONE: Record<string, string> = {
  apply: 'success.main',
  plan: 'info.main',
  destroy: 'error.main',
};

const eventTone = (eventType?: string) => EVENT_TONE[eventType ?? ''] ?? 'warning.main';

export default function HorizontalStepperWithError({ events }: { events: Event[] }) {
  // Helper functions to check if each step has been reached
  // const hasRequest = events.some(event => event.status === 'requested');
  const hasInitiate = events.some((event) => event.status === 'initiated');
  const hasPlan = events.some((event) => event.status === 'plan');
  // const hasApply = events.some(event => event.status === 'apply');
  const hasFinished = events.some((event) => event.status === 'successful');
  const hasFailed = events.some((event) => event.status === 'error');
  const hasFailedPolicy = events.some((event) => event.status === 'failed_policy');
  const waitingOnDependencies = events.some((event) => event.status === 'waiting-on-dependency');

  const lastActiveStep: number = (() => {
    if (hasFinished) {
      return 4;
    } else if (hasFailedPolicy || hasPlan) {
      return 2;
    } else if (hasInitiate || waitingOnDependencies) {
      return 1;
    }
    return 0;
  })();

  return (
    <Box sx={{ width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Stepper activeStep={lastActiveStep}>
          {steps.map((label, index) => {
            const labelProps: {
              optional?: React.ReactNode;
              error?: boolean;
            } = {};
            const stepProps: {
              completed?: boolean;
              icon?: React.ReactNode;
            } = {};

            if (hasFailedPolicy && index === 2) {
              labelProps.optional = (
                <Typography variant="caption" color="error">
                  Failure
                </Typography>
              );
              labelProps.error = true;
            }

            if (waitingOnDependencies && index === 1) {
              labelProps.optional = (
                <Typography variant="caption" color="error">
                  Waiting on dependencies
                </Typography>
              );
              labelProps.error = true;
            }

            let label2 = <></>;
            if (index === 0) {
              labelProps.optional = (
                <Typography variant="caption" color="info">
                  {events.find((event) => event.status === 'requested')?.timestamp}
                </Typography>
              );

              const event = events.find((event) => event.status === 'requested');
              label2 = (
                <Typography
                  variant="body2"
                  sx={{ color: eventTone(event?.event), fontWeight: 500 }}
                >
                  {events.find((event) => event.status === 'requested')?.event}
                </Typography>
              );
            }

            const eventType = events.find((event) => event.status === 'requested')?.event;

            stepProps.completed = index <= lastActiveStep;

            stepProps.icon = (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={24} />
              </Box>
            );

            return (
              <Step key={label} {...stepProps}>
                <StepLabel
                  StepIconComponent={(props) => (
                    <CustomStepIcon
                      index={index}
                      eventType={eventType}
                      inProgress={
                        index === lastActiveStep &&
                        !hasFinished &&
                        !hasFailedPolicy &&
                        !waitingOnDependencies
                      }
                      finished={hasFailedPolicy || hasFinished}
                      completed={index < lastActiveStep}
                      failed={
                        (hasFailed && index == 1) ||
                        (hasFailedPolicy && index === 2) ||
                        (waitingOnDependencies && index === 1)
                      }
                      inactive={index > lastActiveStep}
                      icon={props.icon}
                    />
                  )}
                  {...labelProps}
                >
                  {label} {label2}
                </StepLabel>
              </Step>
            );
          })}
        </Stepper>

        <Typography variant="caption" color="info" style={{ marginLeft: 40 }}>
          {'Initiated by: '}
          {events.find((event) => event.status === 'requested')?.initiated_by}
        </Typography>
      </div>
    </Box>
  );
}

const CustomStepIcon = (props: {
  index?: number;
  eventType?: string;
  inProgress: boolean;
  finished: boolean;
  completed: boolean;
  failed: boolean;
  inactive: boolean;
  icon: React.ReactNode;
}) => {
  const { index, eventType, inProgress, finished, completed, failed, inactive, icon } = props;

  if (index === 0 && eventType) {
    const EventIcon =
      eventType === 'plan' ? DescriptionIcon : eventType === 'destroy' ? DeleteIcon : PlayArrowIcon;

    // If it's the current/completed step, use color. If inactive, simplify?
    // Usually 'Requested' is always completed or in progress if we have events.
    return <EventIcon sx={{ color: inactive ? 'text.disabled' : eventTone(eventType) }} />;
  }

  if (failed) {
    return <ErrorOutline sx={{ color: 'error.main' }} />;
  }

  if (inProgress) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (inactive) {
    return <CloseIcon sx={{ color: 'text.disabled' }} />;
  }

  if (completed) {
    return <CheckIcon sx={{ color: 'success.main' }} />;
  }

  if (finished) {
    return <CheckCircleIcon sx={{ color: 'success.main' }} />;
  }

  return <Box>{icon}</Box>;
};
