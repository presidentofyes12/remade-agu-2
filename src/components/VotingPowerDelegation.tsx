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
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { VotingPowerService } from '../services/votingPowerService';
import { Delegation, DelegationType } from '../types/votingDelegation';
import { LoadingStateService } from '../services/loadingStateService';
import { ethers } from 'ethers';

interface VotingPowerDelegationProps {
  loadingStateService: LoadingStateService;
  votingPowerService: VotingPowerService;
}

export const VotingPowerDelegation: React.FC<VotingPowerDelegationProps> = ({
  loadingStateService,
  votingPowerService
}) => {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDelegation, setEditingDelegation] = useState<Delegation | null>(null);
  const [formData, setFormData] = useState({
    delegate: '',
    type: 'full' as DelegationType,
    amount: '',
    percentage: '',
    reason: ''
  });
  const [votingPower, setVotingPower] = useState<bigint>(BigInt(0));

  useEffect(() => {
    loadDelegations();
    loadVotingPower();
  }, []);

  const loadDelegations = async () => {
    try {
      const currentUser = await votingPowerService.getCurrentUser();
      const userDelegations = await votingPowerService.getDelegationsByDelegator(currentUser);
      setDelegations(userDelegations);
    } catch (error) {
      console.error('Error loading delegations:', error);
    }
  };

  const loadVotingPower = async () => {
    try {
      const currentUser = await votingPowerService.getCurrentUser();
      const power = await votingPowerService.getEffectiveVotingPower(currentUser);
      setVotingPower(power);
    } catch (error) {
      console.error('Error loading voting power:', error);
    }
  };

  const handleOpenDialog = (delegation?: Delegation) => {
    if (delegation) {
      setEditingDelegation(delegation);
      setFormData({
        delegate: delegation.delegate,
        type: delegation.type,
        amount: delegation.amount.toString(),
        percentage: delegation.percentage.toString(),
        reason: delegation.metadata.reason || ''
      });
    } else {
      setEditingDelegation(null);
      setFormData({
        delegate: '',
        type: 'full',
        amount: '',
        percentage: '',
        reason: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingDelegation(null);
    setFormData({
      delegate: '',
      type: 'full',
      amount: '',
      percentage: '',
      reason: ''
    });
  };

  const handleSubmit = async () => {
    try {
      const amount = formData.amount ? BigInt(formData.amount) : BigInt(0);
      const percentage = formData.percentage ? Number(formData.percentage) : 0;

      if (editingDelegation) {
        await votingPowerService.updateDelegation(
          editingDelegation.id,
          formData.type,
          amount,
          percentage,
          formData.reason
        );
      } else {
        await votingPowerService.createDelegation(
          formData.delegate,
          formData.type,
          amount,
          percentage,
          formData.reason
        );
      }

      handleCloseDialog();
      loadDelegations();
      loadVotingPower();
    } catch (error) {
      console.error('Error submitting delegation:', error);
    }
  };

  const handleRevoke = async (delegationId: string) => {
    try {
      await votingPowerService.revokeDelegation(delegationId);
      loadDelegations();
      loadVotingPower();
    } catch (error) {
      console.error('Error revoking delegation:', error);
    }
  };

  const formatVotingPower = (power: bigint): string => {
    return ethers.formatUnits(power, 18);
  };

  return (
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Your Voting Power
              </Typography>
              <Typography variant="h4">
                {formatVotingPower(votingPower)}
              </Typography>
            </Box>
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Your Delegations</Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handleOpenDialog()}
                >
                  Create Delegation
                </Button>
              </Box>
              <List>
                {delegations.map((delegation) => (
                  <React.Fragment key={delegation.id}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <PersonIcon color="primary" />
                            <Typography>
                              {delegation.type.charAt(0).toUpperCase() + delegation.type.slice(1)} Delegation
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography component="span" variant="body2">
                              Delegate: {delegation.delegate}
                            </Typography>
                            <br />
                            <Typography component="span" variant="body2">
                              {delegation.type === 'full' ? 'Full Voting Power' :
                               delegation.type === 'partial' ? `Amount: ${formatVotingPower(delegation.amount)}` :
                               `Percentage: ${delegation.percentage}%`}
                            </Typography>
                            {delegation.metadata.reason && (
                              <>
                                <br />
                                <Typography component="span" variant="body2">
                                  Reason: {delegation.metadata.reason}
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
                          onClick={() => handleOpenDialog(delegation)}
                          data-testid="EditIcon"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleRevoke(delegation.id)}
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
          {editingDelegation ? 'Edit Delegation' : 'Create Delegation'}
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
            <TextField
              label="Delegate Address"
              value={formData.delegate}
              onChange={(e) => setFormData({ ...formData, delegate: e.target.value })}
              fullWidth
              required
            />
            <FormControl fullWidth>
              <InputLabel>Delegation Type</InputLabel>
              <Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as DelegationType })}
                label="Delegation Type"
              >
                <MenuItem value="full">Full Voting Power</MenuItem>
                <MenuItem value="partial">Partial Amount</MenuItem>
                <MenuItem value="percentage">Percentage</MenuItem>
              </Select>
            </FormControl>
            {formData.type === 'partial' && (
              <TextField
                label="Amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                fullWidth
                required
              />
            )}
            {formData.type === 'percentage' && (
              <TextField
                label="Percentage"
                type="number"
                value={formData.percentage}
                onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
                fullWidth
                required
              />
            )}
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
            {editingDelegation ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 