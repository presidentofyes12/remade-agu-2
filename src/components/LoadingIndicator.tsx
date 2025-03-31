import React from 'react';
import { LoadingOperation, LoadingState } from '../types/loadingStates';
import { useLoadingState } from '../contexts/LoadingStateContext';
import { CircularProgress, LinearProgress, Typography, Box, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';

interface LoadingIndicatorProps {
  operation: LoadingOperation;
  variant?: 'circular' | 'linear';
  size?: number;
  showStatus?: boolean;
  showProgress?: boolean;
}

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const ProgressContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const getStateColor = (state: LoadingState): string => {
  switch (state) {
    case 'success':
      return '#4caf50';
    case 'error':
      return '#f44336';
    case 'processing':
      return '#2196f3';
    default:
      return '#757575';
  }
};

const getStateText = (state: LoadingState): string => {
  switch (state) {
    case 'initializing':
      return 'Initializing...';
    case 'loading':
      return 'Loading...';
    case 'processing':
      return 'Processing...';
    case 'success':
      return 'Completed';
    case 'error':
      return 'Error';
    default:
      return '';
  }
};

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  operation,
  variant = 'circular',
  size = 40,
  showStatus = true,
  showProgress = true,
}) => {
  const [state, setState] = React.useState<LoadingState>('idle');
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | undefined>();
  const { loadingStateService } = useLoadingState();

  React.useEffect(() => {
    const handleStateChange = (event: any) => {
      if (event.operation === operation) {
        setState(event.newState);
      }
    };

    const handleProgressUpdate = (event: any) => {
      if (event.operation === operation) {
        setProgress(event.progress);
      }
    };

    const handleOperationComplete = (event: any) => {
      if (event.operation === operation) {
        setState(event.success ? 'success' : 'error');
        if (!event.success) {
          setError(event.error);
        }
      }
    };

    loadingStateService.on('StateChanged', handleStateChange);
    loadingStateService.on('ProgressUpdated', handleProgressUpdate);
    loadingStateService.on('OperationCompleted', handleOperationComplete);

    return () => {
      loadingStateService.off('StateChanged', handleStateChange);
      loadingStateService.off('ProgressUpdated', handleProgressUpdate);
      loadingStateService.off('OperationCompleted', handleOperationComplete);
    };
  }, [operation, loadingStateService]);

  const currentState = loadingStateService.getOperationState(operation);
  const currentProgress = loadingStateService.getOperationProgress(operation);

  if (!currentState || currentState.state === 'idle') {
    return null;
  }

  return (
    <StyledPaper>
      <ProgressContainer>
        {variant === 'circular' ? (
          <CircularProgress
            size={size}
            value={showProgress ? currentProgress : undefined}
            sx={{ color: getStateColor(currentState.state) }}
          />
        ) : (
          <LinearProgress
            variant={showProgress ? 'determinate' : 'indeterminate'}
            value={currentProgress}
            sx={{ width: '100%', color: getStateColor(currentState.state) }}
          />
        )}
        {showStatus && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ color: getStateColor(currentState.state) }}
          >
            {getStateText(currentState.state)}
          </Typography>
        )}
      </ProgressContainer>
      {error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}
    </StyledPaper>
  );
}; 