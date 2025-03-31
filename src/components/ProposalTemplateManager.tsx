import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Stack
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { ProposalTemplateService } from '../services/proposalTemplateService';
import { ProposalTemplate, ProposalType, ProposalField, ProposalTemplateConfig } from '../types/proposalTemplates';
import { useLoadingState } from '../contexts/LoadingStateContext';

interface ProposalTemplateManagerProps {
  onTemplateSelect?: (template: ProposalTemplate) => void;
}

const defaultConfig: ProposalTemplateConfig = {
  templateUpdateDelay: 60,
  templateDeletionDelay: 300,
  maxTemplatesPerType: 10,
  minTemplateVersion: '1.0.0'
};

export const ProposalTemplateManager: React.FC<ProposalTemplateManagerProps> = ({ onTemplateSelect }) => {
  const { loadingStateService } = useLoadingState();
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<ProposalTemplate>>({
    type: 'governance',
    name: '',
    description: '',
    fields: [],
    stages: {
      draft: {
        duration: 86400,
        quorum: 50,
        threshold: 60,
        tokenDistribution: 100
      }
    }
  });

  const loadTemplates = React.useCallback(async () => {
    try {
      const service = ProposalTemplateService.getInstance(loadingStateService, defaultConfig);
      const loadedTemplates = await service.getAllTemplates();
      setTemplates(loadedTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }, [loadingStateService]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setFormData({
      type: 'governance',
      name: '',
      description: '',
      fields: [],
      stages: {
        draft: {
          duration: 86400,
          quorum: 50,
          threshold: 60,
          tokenDistribution: 100
        }
      }
    });
    setIsDialogOpen(true);
  };

  const handleEditTemplate = (template: ProposalTemplate) => {
    setSelectedTemplate(template);
    setFormData(template);
    setIsDialogOpen(true);
  };

  const handleDeleteTemplate = (template: ProposalTemplate) => {
    setSelectedTemplate(template);
    setIsDeleteDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    try {
      const service = ProposalTemplateService.getInstance(loadingStateService, defaultConfig);

      if (selectedTemplate) {
        await service.updateTemplate(selectedTemplate.id, formData);
      } else {
        await service.createTemplate(formData as Omit<ProposalTemplate, 'id' | 'metadata'>);
      }

      setIsDialogOpen(false);
      loadTemplates();
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedTemplate) return;

    try {
      const service = ProposalTemplateService.getInstance(loadingStateService, defaultConfig);
      await service.deleteTemplate(selectedTemplate.id);
      setIsDeleteDialogOpen(false);
      loadTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handleTemplateSelect = (template: ProposalTemplate) => {
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
  };

  const renderTemplateCard = (template: ProposalTemplate) => (
    <Card key={template.id} sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">{template.name}</Typography>
            <Typography color="textSecondary" gutterBottom>
              {template.description}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip label={template.type} size="small" />
              <Chip label={`v${template.metadata.version}`} size="small" />
            </Stack>
          </Box>
          <Box>
            <IconButton onClick={() => handleTemplateSelect(template)} data-testid="AddIcon">
              <AddIcon />
            </IconButton>
            <IconButton onClick={() => handleEditTemplate(template)} data-testid="EditIcon">
              <EditIcon />
            </IconButton>
            <IconButton onClick={() => handleDeleteTemplate(template)} data-testid="DeleteIcon">
              <DeleteIcon />
            </IconButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Proposal Templates</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateTemplate}
        >
          Create Template
        </Button>
      </Box>

      <Grid container spacing={2}>
        {templates.map(renderTemplateCard)}
      </Grid>

      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedTemplate ? 'Edit Template' : 'Create Template'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              margin="normal"
              multiline
              rows={3}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as ProposalType })}
                label="Type"
              >
                <MenuItem value="governance">Governance</MenuItem>
                <MenuItem value="treasury">Treasury</MenuItem>
                <MenuItem value="technical">Technical</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveTemplate} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)}>
        <DialogTitle>Delete Template</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the template "{selectedTemplate?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 