import React, { createContext, useContext, useEffect, useState } from 'react';
import { LoadingStateService } from '../services/loadingStateService';
import { NotificationService } from '../services/notificationService';
import { LoadingOperation, LoadingStateInfo, LoadingStateEvents } from '../types/loadingStates';

interface LoadingStateContextType {
  loadingStateService: LoadingStateService;
  activeOperations: LoadingOperation[];
  getOperationState: (operation: LoadingOperation) => LoadingStateInfo | undefined;
  getOperationProgress: (operation: LoadingOperation) => number;
  on: <K extends keyof LoadingStateEvents>(
    event: K,
    listener: (event: LoadingStateEvents[K]) => void
  ) => void;
  off: <K extends keyof LoadingStateEvents>(
    event: K,
    listener: (event: LoadingStateEvents[K]) => void
  ) => void;
}

const LoadingStateContext = createContext<LoadingStateContextType | null>(null);

interface LoadingStateProviderProps {
  children: React.ReactNode;
  notificationService: NotificationService;
  config: {
    defaultTimeout: number;
    progressUpdateInterval: number;
    maxRetries: number;
    retryDelay: number;
    estimatedDurations: {
      [key in LoadingOperation]: number;
    };
  };
}

export const LoadingStateProvider: React.FC<LoadingStateProviderProps> = ({
  children,
  notificationService,
  config,
}) => {
  const [activeOperations, setActiveOperations] = useState<LoadingOperation[]>([]);
  const loadingStateService = React.useRef(
    LoadingStateService.getInstance(notificationService, config)
  );

  useEffect(() => {
    const handleStateChange = (event: LoadingStateEvents['StateChanged']) => {
      const currentState = loadingStateService.current.getOperationState(event.operation);
      if (currentState) {
        setActiveOperations(prev => {
          if (event.newState === 'success' || event.newState === 'error') {
            return prev.filter(op => op !== event.operation);
          }
          if (!prev.includes(event.operation)) {
            return [...prev, event.operation];
          }
          return prev;
        });
      }
    };

    // Get initial active operations
    setActiveOperations(loadingStateService.current.getActiveOperations());

    // Subscribe to state changes
    loadingStateService.current.on('StateChanged', handleStateChange);

    return () => {
      loadingStateService.current.off('StateChanged', handleStateChange);
    };
  }, []);

  const value = {
    loadingStateService: loadingStateService.current,
    activeOperations,
    getOperationState: (operation: LoadingOperation) =>
      loadingStateService.current.getOperationState(operation),
    getOperationProgress: (operation: LoadingOperation) =>
      loadingStateService.current.getOperationProgress(operation),
    on: <K extends keyof LoadingStateEvents>(
      event: K,
      listener: (event: LoadingStateEvents[K]) => void
    ) => loadingStateService.current.on(event, listener),
    off: <K extends keyof LoadingStateEvents>(
      event: K,
      listener: (event: LoadingStateEvents[K]) => void
    ) => loadingStateService.current.off(event, listener),
  };

  return (
    <LoadingStateContext.Provider value={value}>
      {children}
    </LoadingStateContext.Provider>
  );
};

export const useLoadingState = () => {
  const context = useContext(LoadingStateContext);
  if (!context) {
    throw new Error('useLoadingState must be used within a LoadingStateProvider');
  }
  return context;
}; 