import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProposalTemplateManager } from '../ProposalTemplateManager';
import { ProposalTemplateService } from '../../services/proposalTemplateService';
import { LoadingStateService } from '../../services/loadingStateService';
import { ProposalType, ProposalTemplate } from '../../types/proposalTemplates';

jest.mock('../../services/proposalTemplateService');
jest.mock('../../services/loadingStateService');
jest.mock('../../contexts/LoadingStateContext', () => ({
  useLoadingState: () => ({
    getOperationState: jest.fn()
  })
}));

describe('ProposalTemplateManager', () => {
  const mockTemplates: ProposalTemplate[] = [
    {
      id: '1',
      type: 'governance' as ProposalType,
      name: 'Test Template 1',
      description: 'Test Description 1',
      fields: [],
      stages: {
        draft: {
          duration: 86400,
          quorum: 50,
          threshold: 60,
          tokenDistribution: 100
        }
      },
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        creator: '0x123',
        tags: []
      }
    },
    {
      id: '2',
      type: 'treasury' as ProposalType,
      name: 'Test Template 2',
      description: 'Test Description 2',
      fields: [],
      stages: {
        draft: {
          duration: 86400,
          quorum: 50,
          threshold: 60,
          tokenDistribution: 100
        }
      },
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        creator: '0x123',
        tags: []
      }
    }
  ];

  const mockGetAllTemplates = jest.fn();
  const mockCreateTemplate = jest.fn();
  const mockUpdateTemplate = jest.fn();
  const mockDeleteTemplate = jest.fn();
  const mockOnTemplateSelect = jest.fn();

  beforeEach(() => {
    mockGetAllTemplates.mockResolvedValue(mockTemplates);
    (ProposalTemplateService.getInstance as jest.Mock).mockReturnValue({
      getAllTemplates: mockGetAllTemplates,
      createTemplate: mockCreateTemplate,
      updateTemplate: mockUpdateTemplate,
      deleteTemplate: mockDeleteTemplate
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders template list correctly', async () => {
    render(<ProposalTemplateManager onTemplateSelect={mockOnTemplateSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Test Template 1')).toBeInTheDocument();
      expect(screen.getByText('Test Template 2')).toBeInTheDocument();
    });
  });

  it('opens create template dialog when clicking create button', async () => {
    render(<ProposalTemplateManager onTemplateSelect={mockOnTemplateSelect} />);

    const createButton = screen.getByText('Create Template');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create Template')).toBeInTheDocument();
    });
  });

  it('creates a new template when submitting the form', async () => {
    render(<ProposalTemplateManager onTemplateSelect={mockOnTemplateSelect} />);

    // Open create dialog
    const createButton = screen.getByText('Create Template');
    fireEvent.click(createButton);

    // Fill in form
    const nameInput = screen.getByLabelText('Name');
    const descriptionInput = screen.getByLabelText('Description');
    fireEvent.change(nameInput, { target: { value: 'New Template' } });
    fireEvent.change(descriptionInput, { target: { value: 'New Description' } });

    // Submit form
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockCreateTemplate).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Template',
        description: 'New Description'
      }));
    });
  });

  it('opens edit template dialog when clicking edit button', async () => {
    render(<ProposalTemplateManager onTemplateSelect={mockOnTemplateSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Test Template 1')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTestId('EditIcon');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Template')).toBeInTheDocument();
      expect(screen.getByLabelText('Name')).toHaveValue('Test Template 1');
    });
  });

  it('updates template when submitting edit form', async () => {
    render(<ProposalTemplateManager onTemplateSelect={mockOnTemplateSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Test Template 1')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTestId('EditIcon');
    fireEvent.click(editButtons[0]);

    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Updated Template' } });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateTemplate).toHaveBeenCalledWith('1', expect.objectContaining({
        name: 'Updated Template'
      }));
    });
  });

  it('opens delete confirmation dialog when clicking delete button', async () => {
    render(<ProposalTemplateManager onTemplateSelect={mockOnTemplateSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Test Template 1')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTestId('DeleteIcon');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Delete Template')).toBeInTheDocument();
    });
  });

  it('deletes template when confirming deletion', async () => {
    render(<ProposalTemplateManager onTemplateSelect={mockOnTemplateSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Test Template 1')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTestId('DeleteIcon');
    fireEvent.click(deleteButtons[0]);

    const confirmButton = screen.getByText('Delete');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteTemplate).toHaveBeenCalledWith('1');
    });
  });

  it('calls onTemplateSelect when clicking select button', async () => {
    render(<ProposalTemplateManager onTemplateSelect={mockOnTemplateSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Test Template 1')).toBeInTheDocument();
    });

    const selectButtons = screen.getAllByTestId('AddIcon');
    fireEvent.click(selectButtons[0]);

    expect(mockOnTemplateSelect).toHaveBeenCalledWith(mockTemplates[0]);
  });
}); 