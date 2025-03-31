import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  RadioGroup,
  Radio,
  FormControlLabel,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import {
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Help as HelpIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { ProposalVotingService } from '../services/proposalVotingService';
import { Vote, VoteType } from '../types/proposalVoting';
import { LoadingStateService } from '../services/loadingStateService';
import { ethers } from 'ethers';

interface ProposalVotingProps {
  proposalId: string;
  loadingStateService: LoadingStateService;
  proposalVotingService: ProposalVotingService;
}

export const ProposalVoting: React.FC<ProposalVotingProps> = ({
  proposalId,
  loadingStateService,
  proposalVotingService
}) => {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingVote, setEditingVote] = useState<Vote | null>(null);
  const [formData, setFormData] = useState({
    voteType: 'abstain' as VoteType,
    reason: ''
  });
  const [voteCounts, setVoteCounts] = useState({
    yes: BigInt(0),
    no: BigInt(0),
    abstain: BigInt(0),
    total: BigInt(0)
  });
  const [votingPower, setVotingPower] = useState<bigint>(BigInt(0));

  useEffect(() => {
    loadVotes();
    loadVotingPower();
  }, [proposalId]);

  const loadVotes = async () => {
    try {
      const proposalVotes = await proposalVotingService.getVotesByProposal(proposalId);
      const counts = await proposalVotingService.getProposalVoteCount(proposalId);
      setVotes(proposalVotes);
      setVoteCounts(counts);
    } catch (error) {
      console.error('Error loading votes:', error);
    }
  };

  const loadVotingPower = async () => {
    try {
      const currentUser = await proposalVotingService.getCurrentUser();
      const power = await proposalVotingService.getVotingPower(currentUser);
      setVotingPower(power);
    } catch (error) {
      console.error('Error loading voting power:', error);
    }
  };

  const handleOpenDialog = (vote?: Vote) => {
    if (vote) {
      setEditingVote(vote);
      setFormData({
        voteType: vote.voteType,
        reason: vote.metadata.reason || ''
      });
    } else {
      setEditingVote(null);
      setFormData({
        voteType: 'abstain',
        reason: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingVote(null);
    setFormData({
      voteType: 'abstain',
      reason: ''
    });
  };

  const handleSubmit = async () => {
    try {
      if (editingVote) {
        await proposalVotingService.changeVote(
          editingVote.id,
          formData.voteType,
          formData.reason
        );
      } else {
        await proposalVotingService.castVote(
          proposalId,
          formData.voteType,
          formData.reason
        );
      }

      handleCloseDialog();
      loadVotes();
    } catch (error) {
      console.error('Error submitting vote:', error);
    }
  };

  const handleRevoke = async (voteId: string) => {
    try {
      await proposalVotingService.revokeVote(voteId);
      loadVotes();
    } catch (error) {
      console.error('Error revoking vote:', error);
    }
  };

  const formatVotingPower = (power: bigint): string => {
    return ethers.formatUnits(power, 18);
  };

  const calculatePercentage = (value: bigint, total: bigint): number => {
    if (total === BigInt(0)) return 0;
    return Number((value * BigInt(100)) / total);
  };

  return (
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Voting Power
              </Typography>
              <Typography variant="h4">
                {formatVotingPower(votingPower)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6" gutterBottom>
                Vote Distribution
              </Typography>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>Yes</Typography>
                  <Typography>{formatVotingPower(voteCounts.yes)}</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={calculatePercentage(voteCounts.yes, voteCounts.total)}
                  color="success"
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>No</Typography>
                  <Typography>{formatVotingPower(voteCounts.no)}</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={calculatePercentage(voteCounts.no, voteCounts.total)}
                  color="error"
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>Abstain</Typography>
                  <Typography>{formatVotingPower(voteCounts.abstain)}</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={calculatePercentage(voteCounts.abstain, voteCounts.total)}
                  color="warning"
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
            </Box>
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Your Vote</Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handleOpenDialog()}
                >
                  Cast Vote
                </Button>
              </Box>
              <List>
                {votes.map((vote) => (
                  <React.Fragment key={vote.id}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            {vote.voteType === 'yes' && <ThumbUpIcon color="success" />}
                            {vote.voteType === 'no' && <ThumbDownIcon color="error" />}
                            {vote.voteType === 'abstain' && <HelpIcon color="warning" />}
                            <Typography>
                              {vote.voteType.charAt(0).toUpperCase() + vote.voteType.slice(1)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography component="span" variant="body2">
                              Power: {formatVotingPower(vote.votingPower)}
                            </Typography>
                            {vote.metadata.reason && (
                              <>
                                <br />
                                <Typography component="span" variant="body2">
                                  Reason: {vote.metadata.reason}
                                </Typography>
                              </>
                            )}
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          aria-label="edit"
                          onClick={() => handleOpenDialog(vote)}
                          data-testid="EditIcon"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleRevoke(vote.id)}
                          data-testid="DeleteIcon"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingVote ? 'Change Vote' : 'Cast Vote'}
          <IconButton
            aria-label="close"
            onClick={handleCloseDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={2}>
            <RadioGroup
              value={formData.voteType}
              onChange={(e) => setFormData({ ...formData, voteType: e.target.value as VoteType })}
            >
              <FormControlLabel
                value="yes"
                control={<Radio color="success" />}
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <ThumbUpIcon color="success" />
                    <Typography>Yes</Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="no"
                control={<Radio color="error" />}
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <ThumbDownIcon color="error" />
                    <Typography>No</Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="abstain"
                control={<Radio color="warning" />}
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <HelpIcon color="warning" />
                    <Typography>Abstain</Typography>
                  </Box>
                }
              />
            </RadioGroup>
            <TextField
              label="Reason (optional)"
              multiline
              rows={4}
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {editingVote ? 'Change Vote' : 'Cast Vote'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 