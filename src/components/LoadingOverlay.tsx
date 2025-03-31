import React from 'react';
import { Box, Backdrop, Typography, Stack } from '@mui/material';
import { styled } from '@mui/material/styles';
import { LoadingIndicator } from './LoadingIndicator';
import { useLoadingState } from '../contexts/LoadingStateContext';
import { LoadingOperation } from '../types/loadingStates';

const StyledBackdrop = styled(Backdrop)(({ theme }) => ({
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
  maxWidth: 400,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

const getOperationLabel = (operation: LoadingOperation): string => {
  switch (operation) {
    case 'transaction':
      return 'Transaction';
    case 'keyRotation':
      return 'Key Rotation';
    case 'backup':
      return 'Backup';
    case 'multiSig':
      return 'Multi-Signature';
    case 'contractInteraction':
      return 'Contract Interaction';
    case 'dataFetch':
      return 'Data Fetch';
    default:
      return operation;
  }
};

export const LoadingOverlay: React.FC = () => {
  const { activeOperations } = useLoadingState();

  if (activeOperations.length === 0) {
    return null;
  }

  return (
    <StyledBackdrop open>
      <LoadingContainer>
        <Typography variant="h6" color="text.primary">
          Processing Operations
        </Typography>
        <Stack spacing={2}>
          {activeOperations.map((operation) => (
            <Box key={operation}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {getOperationLabel(operation)}
              </Typography>
              <LoadingIndicator
                operation={operation}
                variant="linear"
                showStatus
                showProgress
              />
            </Box>
          ))}
        </Stack>
      </LoadingContainer>
    </StyledBackdrop>
  );
}; 