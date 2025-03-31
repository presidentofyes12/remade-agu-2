import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Chip,
  Alert
} from '@mui/material';
import {
  Timer as TimerIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayArrowIcon,
  Cancel as CancelIcon,
  Shield as ShieldIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { ProposalExecutionService } from '../services/proposalExecutionService';
import { ExecutionState, ExecutionAction } from '../types/proposalExecution';
import { LoadingStateService } from '../services/loadingStateService';
import { ethers } from 'ethers';

interface ProposalExecutionProps {
  proposalId: string;
  loadingStateService: LoadingStateService;
  executionService: ProposalExecutionService;
}

export const ProposalExecution: React.FC<ProposalExecutionProps> = ({
  proposalId,
  loadingStateService,
  executionService
}) => {
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [openCancelDialog, setOpenCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    loadExecutionState();
    const interval = setInterval(loadExecutionState, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [proposalId]);

  const loadExecutionState = async () => {
    try {
      setLoading(true);
      const state = await executionService.getExecutionState(proposalId);
      setExecutionState(state);
    } catch (error) {
      console.error('Error loading execution state:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    try {
      await executionService.executeProposal(proposalId);
      loadExecutionState();
    } catch (error) {
      console.error('Error executing proposal:', error);
    }
  };

  const handleCancel = async () => {
    try {
      await executionService.cancelExecution(proposalId, cancelReason);
      setOpenCancelDialog(false);
      setCancelReason('');
      loadExecutionState();
    } catch (error) {
      console.error('Error cancelling execution:', error);
    }
  };

  const handleGuardianApprove = async () => {
    try {
      await executionService.approveExecution(proposalId);
      loadExecutionState();
    } catch (error) {
      console.error('Error approving execution:', error);
    }
  };

  const handleGuardianReject = async () => {
    try {
      await executionService.rejectExecution(proposalId);
      loadExecutionState();
    } catch (error) {
      console.error('Error rejecting execution:', error);
    }
  };

  const formatTimeRemaining = (ms: number): string => {
    if (ms <= 0) return 'Ended';
    
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const formatValue = (value: bigint): string => {
    return ethers.formatEther(value);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  if (!executionState) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">Failed to load execution state</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Execution Status</Typography>
              <Tooltip title="Refresh">
                <IconButton onClick={loadExecutionState} data-testid="RefreshIcon">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>

            <Box display="flex" flexWrap="wrap" gap={1}>
              <Chip
                icon={<TimerIcon />}
                label={`Status: ${executionState.status.charAt(0).toUpperCase() + executionState.status.slice(1)}`}
                color={
                  executionState.status === 'completed' ? 'success' :
                  executionState.status === 'failed' ? 'error' :
                  executionState.status === 'cancelled' ? 'default' :
                  'primary'
                }
                variant="outlined"
              />
              <Chip
                icon={<TimerIcon />}
                label={`Time Remaining: ${formatTimeRemaining(executionState.executionWindowEnd - Date.now())}`}
                color="primary"
                variant="outlined"
              />
              {executionState.metadata.guardianApproved && (
                <Chip
                  icon={<ShieldIcon />}
                  label="Guardian Approved"
                  color="success"
                  variant="outlined"
                />
              )}
            </Box>

            {executionState.error && (
              <Alert severity="error">
                {executionState.error}
              </Alert>
            )}

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Execution Actions
              </Typography>
              <List>
                {executionState.actions.map((action: ExecutionAction, index: number) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemText
                        primary={action.description}
                        secondary={
                          <>
                            <Typography component="span" variant="body2">
                              Target: {action.target}
                            </Typography>
                            <br />
                            <Typography component="span" variant="body2">
                              Value: {formatValue(action.value)} ETH
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            </Box>

            <Box display="flex" gap={1} justifyContent="flex-end">
              {executionState.status === 'ready' && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PlayArrowIcon />}
                  onClick={handleExecute}
                  data-testid="ExecuteButton"
                >
                  Execute
                </Button>
              )}
              {executionState.status === 'pending' && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={() => setOpenCancelDialog(true)}
                  data-testid="CancelButton"
                >
                  Cancel
                </Button>
              )}
              {executionState.status === 'ready' && executionState.metadata.guardianApproved === false && (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<ShieldIcon />}
                    onClick={handleGuardianApprove}
                    data-testid="ApproveButton"
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<ShieldIcon />}
                    onClick={handleGuardianReject}
                    data-testid="RejectButton"
                  >
                    Reject
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={openCancelDialog} onClose={() => setOpenCancelDialog(false)}>
        <DialogTitle>
          Cancel Execution
          <IconButton
            aria-label="close"
            onClick={() => setOpenCancelDialog(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Reason"
            fullWidth
            multiline
            rows={4}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCancelDialog(false)}>Cancel</Button>
          <Button onClick={handleCancel} color="error" variant="contained">
            Confirm Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 