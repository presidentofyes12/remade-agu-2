import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAuth } from '../../hooks/useAuth';
import { useNostr } from '../../hooks/useNostr';
import { ErrorBoundary } from '../ErrorBoundary';
import styles from './ProposalWorkflow.module.css';

type StageStatus = 'pending' | 'active' | 'completed';

interface Stage {
  id: number;
  name: string;
  percentage: number;
  description: string;
  status: StageStatus;
  participants: string[];
  funding: bigint;
}

interface ProposalWorkflowProps {
  daoId: string;
  proposalId: string;
  totalFunding: bigint;
  onError?: (error: Error) => void;
}

interface NostrEvent {
  kind: number;
  content: string;
  tags: [string, string][];
}

interface ContractError extends Error {
  code?: string;
  transactionHash?: string;
  data?: string;
}

interface LoadingState {
  isLoading: boolean;
  isTransitioning: boolean;
  isDistributing: boolean;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

// Contract ABI with proper typing
const WORKFLOW_ABI = [
  'function getProposalStage(string) view returns (uint8)',
  'function getStageParticipants(string, uint8) view returns (address[])',
  'function getStageFunding(string, uint8) view returns (uint256)',
  'function transitionStage(string, uint8)',
  'function distributeStageFunding(string, uint8)'
] as const;

const STAGES: Omit<Stage, 'status' | 'participants' | 'funding'>[] = [
  {
    id: 0,
    name: 'Idea',
    percentage: 0.9259,
    description: 'Initial proposal submission and approval'
  },
  {
    id: 1,
    name: 'Discovery',
    percentage: 1.8519,
    description: 'Project research and validation'
  },
  {
    id: 2,
    name: 'Match',
    percentage: 2.7778,
    description: 'Team and resource matching'
  },
  {
    id: 3,
    name: 'Contract',
    percentage: 3.7037,
    description: 'Smart contract development and verification'
  },
  {
    id: 4,
    name: 'Expectations',
    percentage: 4.6296,
    description: 'Risk analysis and insurance setup'
  },
  {
    id: 5,
    name: 'Execution',
    percentage: 5.5556,
    description: 'Project implementation and delivery'
  },
  {
    id: 6,
    name: 'Marketplace',
    percentage: 6.4815,
    description: 'Marketing and distribution'
  },
  {
    id: 7,
    name: 'Rating',
    percentage: 7.4074,
    description: 'Project evaluation and feedback'
  }
];

export const ProposalWorkflow: React.FC<ProposalWorkflowProps> = ({
  daoId,
  proposalId,
  totalFunding,
  onError
}) => {
  const { wallet, provider, address } = useAuth();
  const { publishEvent } = useNostr();
  const [stages, setStages] = useState<Stage[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    isTransitioning: false,
    isDistributing: false
  });
  const [error, setError] = useState<string>('');
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);
  const MAX_RETRIES = 3;
  const RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000
  };

  const initializeStages = useCallback(() => {
    const initializedStages = STAGES.map(stage => ({
      ...stage,
      status: 'pending' as StageStatus,
      participants: [],
      funding: 0n
    }));
    setStages(initializedStages);
  }, []);

  useEffect(() => {
    initializeStages();
    loadWorkflowState();
  }, [daoId, proposalId, initializeStages]);

  const handleError = useCallback((error: unknown) => {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    setError(errorMessage);
    onError?.(error instanceof Error ? error : new Error(errorMessage));
  }, [onError]);

  const loadWorkflowState = useCallback(async () => {
    try {
      setLoadingState(prev => ({ ...prev, isLoading: true }));
      setError('');

      if (!wallet || !provider) {
        throw new Error('Wallet not connected');
      }

      const contractAddress = process.env.REACT_APP_WORKFLOW_CONTRACT_ADDRESS;
      if (!contractAddress) {
        throw new Error('Workflow contract address not configured');
      }

      if (!ethers.isAddress(contractAddress)) {
        throw new Error('Invalid workflow contract address');
      }

      // Load workflow state from contract
      const workflowContract = new ethers.Contract(
        contractAddress,
        WORKFLOW_ABI,
        provider
      );

      const currentStageId = await (workflowContract.getProposalStage as (proposalId: string) => Promise<number>)(proposalId);
      setCurrentStage(currentStageId);

      // Update stages with current state
      const updatedStages = await Promise.all(
        stages.map(async (stage) => {
          const participants = await (workflowContract.getStageParticipants as (proposalId: string, stageId: number) => Promise<string[]>)(proposalId, stage.id);
          const funding = await (workflowContract.getStageFunding as (proposalId: string, stageId: number) => Promise<bigint>)(proposalId, stage.id);
          
          const status: StageStatus = stage.id < currentStageId ? 'completed' : 
                                    stage.id === currentStageId ? 'active' : 'pending';
          
          return {
            ...stage,
            status,
            participants,
            funding: BigInt(funding)
          };
        })
      );

      setStages(updatedStages);
      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      handleError(err);

      // Implement retry logic with exponential backoff
      if (retryCount < RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelay * Math.pow(2, retryCount),
          RETRY_CONFIG.maxDelay
        );
        setRetryCount(prev => prev + 1);
        setTimeout(loadWorkflowState, delay);
      }
    } finally {
      setLoadingState(prev => ({ ...prev, isLoading: false }));
    }
  }, [wallet, provider, proposalId, stages, retryCount, handleError]);

  const handleStageTransition = useCallback(async (stageId: number) => {
    try {
      setLoadingState(prev => ({ ...prev, isTransitioning: true }));
      setError('');

      if (!wallet || !address) {
        throw new Error('Wallet not connected');
      }

      const contractAddress = process.env.REACT_APP_WORKFLOW_CONTRACT_ADDRESS;
      if (!contractAddress) {
        throw new Error('Workflow contract address not configured');
      }

      if (!ethers.isAddress(contractAddress)) {
        throw new Error('Invalid workflow contract address');
      }

      const workflowContract = new ethers.Contract(
        contractAddress,
        WORKFLOW_ABI,
        wallet
      );

      // Transition to next stage
      setLoadingState(prev => ({ ...prev, isTransitioning: true }));
      const transitionTx = await (workflowContract.transitionStage as (proposalId: string, stageId: number) => Promise<ethers.ContractTransactionResponse>)(proposalId, stageId);
      await transitionTx.wait();
      
      // Distribute funding for the stage
      setLoadingState(prev => ({ ...prev, isDistributing: true }));
      const fundingTx = await (workflowContract.distributeStageFunding as (proposalId: string, stageId: number) => Promise<ethers.ContractTransactionResponse>)(proposalId, stageId);
      await fundingTx.wait();

      // Publish stage transition event to Nostr
      const transitionEvent: NostrEvent = {
        kind: 30078,
        content: JSON.stringify({
          proposalId,
          stageId,
          timestamp: Date.now(),
          transactionHash: transitionTx.hash,
          address
        }),
        tags: [
          ['p', address],
          ['e', 'stage-transition']
        ]
      };

      await publishEvent(transitionEvent);
      await loadWorkflowState();
    } catch (err) {
      handleError(err);
    } finally {
      setLoadingState(prev => ({
        ...prev,
        isTransitioning: false,
        isDistributing: false
      }));
    }
  }, [wallet, address, proposalId, loadWorkflowState, publishEvent, handleError]);

  if (loadingState.isLoading) {
    return <div className={styles.loading}>Loading workflow state...</div>;
  }

  if (error) {
    return (
      <div className={styles.error}>
        {error}
        {retryCount < RETRY_CONFIG.maxRetries && (
          <button 
            className={styles.retryButton}
            onClick={loadWorkflowState}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <ErrorBoundary onError={handleError}>
      <div className={styles.container}>
        <h2 className={styles.title}>Proposal Workflow</h2>
        <div className={styles.stages}>
          {stages.map((stage) => (
            <div 
              key={stage.id} 
              className={`${styles.stage} ${styles[stage.status]}`}
            >
              <div className={styles.stageHeader}>
                <h3>{stage.name}</h3>
                <span className={styles.percentage}>{stage.percentage}%</span>
              </div>
              <p className={styles.description}>{stage.description}</p>
              
              <div className={styles.stageDetails}>
                <div className={styles.participants}>
                  <h4>Participants</h4>
                  <ul>
                    {stage.participants.map((participant, index) => (
                      <li key={`${participant}-${index}`}>{participant}</li>
                    ))}
                  </ul>
                </div>
                
                <div className={styles.funding}>
                  <h4>Funding</h4>
                  <p>{ethers.formatEther(stage.funding)} PLS</p>
                </div>
              </div>

              {stage.id === currentStage && (
                <button
                  className={styles.transitionButton}
                  onClick={() => handleStageTransition(stage.id)}
                  disabled={loadingState.isLoading || loadingState.isTransitioning || loadingState.isDistributing}
                >
                  {loadingState.isTransitioning ? 'Transitioning...' : 
                   loadingState.isDistributing ? 'Distributing...' : 
                   'Complete Stage'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </ErrorBoundary>
  );
}; 