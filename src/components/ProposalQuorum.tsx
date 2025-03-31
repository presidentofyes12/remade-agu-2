import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Timer as TimerIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { ProposalQuorumService } from '../services/proposalQuorumService';
import { QuorumStatus } from '../types/proposalQuorum';
import { LoadingStateService } from '../services/loadingStateService';
import { ethers } from 'ethers';

interface ProposalQuorumProps {
  proposalId: string;
  loadingStateService: LoadingStateService;
  quorumService: ProposalQuorumService;
}

export const ProposalQuorum: React.FC<ProposalQuorumProps> = ({
  proposalId,
  loadingStateService,
  quorumService
}) => {
  const [quorumStatus, setQuorumStatus] = useState<QuorumStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuorumStatus();
    const interval = setInterval(loadQuorumStatus, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [proposalId]);

  const loadQuorumStatus = async () => {
    try {
      setLoading(true);
      const status = await quorumService.checkQuorumStatus(proposalId);
      setQuorumStatus(status);
    } catch (error) {
      console.error('Error loading quorum status:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatVotingPower = (power: bigint): string => {
    return ethers.formatUnits(power, 18);
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  if (!quorumStatus) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">Failed to load quorum status</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Quorum Status</Typography>
            <Tooltip title="Refresh">
              <IconButton onClick={loadQuorumStatus} data-testid="RefreshIcon">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          <Box>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2">Progress</Typography>
              <Typography variant="body2">
                {quorumStatus.quorumPercentage.toFixed(2)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={quorumStatus.quorumPercentage}
              color={quorumStatus.isQuorumReached ? 'success' : 'primary'}
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Box>

          <Box display="flex" flexWrap="wrap" gap={1}>
            <Chip
              icon={<TimerIcon />}
              label={`Time Remaining: ${formatTimeRemaining(quorumStatus.timeRemaining)}`}
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={quorumStatus.isQuorumReached ? <CheckCircleIcon /> : <ErrorIcon />}
              label={quorumStatus.isQuorumReached ? 'Quorum Reached' : 'Quorum Not Reached'}
              color={quorumStatus.isQuorumReached ? 'success' : 'error'}
              variant="outlined"
            />
          </Box>

          <Box>
            <Typography variant="body2" color="text.secondary">
              Current Voting Power: {formatVotingPower(quorumStatus.currentVotingPower)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Required Quorum: {formatVotingPower(quorumStatus.requiredQuorum)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Voting Power: {formatVotingPower(quorumStatus.totalVotingPower)}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}; 