import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { VotingPowerService } from '../services/votingPowerService';
import { Delegation, DelegationType } from '../types/votingDelegation';
import { LoadingStateService } from '../services/loadingStateService';
import { ethers } from 'ethers';

interface VotingPowerManagerProps {
  votingPower: bigint;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  loadingStateService: LoadingStateService;
  votingPowerService: VotingPowerService;
}

export const VotingPowerManager: React.FC<VotingPowerManagerProps> = ({
  votingPower,
  children,
  className,
  style,
  loadingStateService,
  votingPowerService
}) => {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDelegation, setEditingDelegation] = useState<Delegation | null>(null);
  const [formData, setFormData] = useState({
    delegate: '',
    type: 'partial' as DelegationType,
    amount: '',
    percentage: '',
    duration: ''
  });
  const [availablePower, setAvailablePower] = useState<bigint>(BigInt(0));
  const [effectivePower, setEffectivePower] = useState<bigint>(BigInt(0));

  useEffect(() => {
    loadDelegations();
    loadVotingPower();
  }, []);

  const loadDelegations = async () => {
    try {
      const currentUser = await votingPowerService.getCurrentUser();
      const userDelegations = await votingPowerService.getActiveDelegations(currentUser);
      setDelegations(userDelegations);
    } catch (error) {
      console.error('Error loading delegations:', error);
    }
  };

  const loadVotingPower = async () => {
    try {
      const currentUser = await votingPowerService.getCurrentUser();
      const available = await votingPowerService.getAvailableVotingPower(currentUser);
      const effective = await votingPowerService.getEffectiveVotingPower(currentUser);
      setAvailablePower(available);
      setEffectivePower(effective);
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
        duration: delegation.endTime ? ((delegation.endTime - delegation.startTime) / 1000).toString() : ''
      });
    } else {
      setEditingDelegation(null);
      setFormData({
        delegate: '',
        type: 'partial',
        amount: '',
        percentage: '',
        duration: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingDelegation(null);
    setFormData({
      delegate: '',
      type: 'partial',
      amount: '',
      percentage: '',
      duration: ''
    });
  };

  const handleSubmit = async () => {
    try {
      if (!ethers.isAddress(formData.delegate)) {
        throw new Error('Invalid delegate address');
      }

      const amount = BigInt(formData.amount || '0');
      const percentage = parseInt(formData.percentage || '0');
      const duration = formData.duration ? formData.duration.toString() : undefined;

      if (editingDelegation) {
        await votingPowerService.updateDelegation(
          editingDelegation.id,
          formData.type,
          amount,
          percentage
        );
      } else {
        await votingPowerService.createDelegation(
          formData.delegate,
          formData.type,
          amount,
          percentage,
          duration
        );
      }

      handleCloseDialog();
      loadDelegations();
      loadVotingPower();
    } catch (error) {
      console.error('Error submitting delegation:', error);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await votingPowerService.revokeDelegation(id);
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
    <div className={className} style={style}>
      <div data-testid="voting-power-display">
        Voting Power: {votingPower.toString()}
      </div>
      {children}
      <Box>
        <Card>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Available Voting Power
                </Typography>
                <Typography variant="h4">
                  {formatVotingPower(availablePower)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Effective Voting Power
                </Typography>
                <Typography variant="h4">
                  {formatVotingPower(effectivePower)}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Active Delegations</Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                  >
                    New Delegation
                  </Button>
                </Box>
                <List>
                  {delegations.map((delegation) => (
                    <React.Fragment key={delegation.id}>
                      <ListItem>
                        <ListItemText
                          primary={`Delegate: ${delegation.delegate}`}
                          secondary={
                            <>
                              <Typography component="span" variant="body2">
                                Type: {delegation.type}
                              </Typography>
                              <br />
                              <Typography component="span" variant="body2">
                                Amount: {formatVotingPower(delegation.amount)}
                              </Typography>
                              {delegation.type === 'percentage' && (
                                <>
                                  <br />
                                  <Typography component="span" variant="body2">
                                    Percentage: {delegation.percentage}%
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
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingDelegation ? 'Edit Delegation' : 'New Delegation'}
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
              <FormControl fullWidth required>
                <InputLabel>Delegation Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as DelegationType })}
                  label="Delegation Type"
                >
                  <MenuItem value="full">Full</MenuItem>
                  <MenuItem value="partial">Partial</MenuItem>
                  <MenuItem value="percentage">Percentage</MenuItem>
                </Select>
              </FormControl>
              {(formData.type === 'partial' || formData.type === 'full') && (
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
                label="Duration (seconds, optional)"
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
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
    </div>
  );
}; 