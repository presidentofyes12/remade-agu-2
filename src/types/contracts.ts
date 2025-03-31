import { ethers } from 'ethers';
import { BaseContract, BigNumberish } from 'ethers';
import { Contract } from 'ethers';

export interface BaseContract {
  address: string;
  provider: ethers.Provider;
  signer?: ethers.Signer;
}

export interface ConceptMappingContract extends BaseContract {
  getConcept(id: string): Promise<any>;
  addConcept(name: string, description: string, parentId: string, metadata: Record<string, any>): Promise<ethers.ContractTransactionResponse>;
  updateConcept(id: string, name: string, description: string, metadata: Record<string, any>): Promise<ethers.ContractTransactionResponse>;
  linkConcepts(parentId: string, childId: string): Promise<ethers.ContractTransactionResponse>;
}

export interface DAOContract extends BaseContract {
  // Proposal Management
  createProposal(
    title: string,
    description: string,
    amount: bigint,
    recipient: string,
    duration: bigint
  ): Promise<ethers.ContractTransactionResponse>;
  vote(proposalId: bigint, support: boolean): Promise<ethers.ContractTransactionResponse>;
  executeProposal(proposalId: bigint): Promise<ethers.ContractTransactionResponse>;
  cancelProposal(proposalId: bigint): Promise<ethers.ContractTransactionResponse>;
  getProposal(proposalId: bigint): Promise<ProposalData>;
  getProposalCount(): Promise<bigint>;

  // Member Management
  join(): Promise<ethers.ContractTransactionResponse>;
  leave(): Promise<ethers.ContractTransactionResponse>;
  isMember(address: string): Promise<boolean>;

  // Fund Management
  deposit(amount: bigint): Promise<ethers.ContractTransactionResponse>;
  withdraw(amount: bigint): Promise<ethers.ContractTransactionResponse>;
  getBalance(): Promise<bigint>;

  // Admin Token Distribution
  getRelayUptime(): Promise<bigint>;
  getUsersServed(): Promise<bigint>;
  getGovernanceActivity(address: string): Promise<bigint>;
  getTotalSupply(): Promise<bigint>;
  getLastDistribution(): Promise<bigint>;
  getTotalDistributed(): Promise<bigint>;
  distributeRewards(): Promise<ethers.ContractTransactionResponse>;

  // Idea Registry
  registerIdea(
    title: string,
    description: string,
    hash: string
  ): Promise<ethers.ContractTransactionResponse>;
  getIdea(ideaId: bigint): Promise<IdeaData>;
  getIdeaCount(): Promise<bigint>;
  calculateSimilarity(ideaId1: bigint, ideaId2: bigint): Promise<number>;
  distributeRoyalties(ideaId: bigint): Promise<ethers.ContractTransactionResponse>;
  getRoyaltyRate(ideaId: bigint): Promise<number>;
  updateRoyaltyRate(ideaId: bigint, newRate: number): Promise<ethers.ContractTransactionResponse>;

  // Knowledge Domain Management
  registerDomain(
    name: string,
    description: string,
    parentId: bigint | null,
    contributionThreshold: bigint
  ): Promise<ethers.ContractTransactionResponse>;
  getDomain(domainId: bigint): Promise<KnowledgeDomain>;
  getDomainCount(): Promise<bigint>;
  updateDomainScores(
    domainId: bigint,
    relevanceScore: number,
    innovationScore: number
  ): Promise<ethers.ContractTransactionResponse>;
  mapProposalToDomain(
    proposalId: bigint,
    domainId: bigint,
    isPrimary: boolean
  ): Promise<ethers.ContractTransactionResponse>;
  getDomainMappings(proposalId: bigint): Promise<DomainMapping[]>;
  getDomainAnalytics(domainId: bigint): Promise<DomainAnalytics>;
  contributeToDomain(
    domainId: bigint,
    amount: bigint
  ): Promise<ethers.ContractTransactionResponse>;

  // Event Handling
  on<K extends keyof (DAOEvents & IdeaRegistryEvents & KnowledgeDomainEvents)>(
    event: K,
    listener: (event: (DAOEvents & IdeaRegistryEvents & KnowledgeDomainEvents)[K]) => void
  ): void;
  off<K extends keyof (DAOEvents & IdeaRegistryEvents & KnowledgeDomainEvents)>(
    event: K,
    listener: (event: (DAOEvents & IdeaRegistryEvents & KnowledgeDomainEvents)[K]) => void
  ): void;
}

export interface DAOTokenContract extends BaseContract {
  balanceOf(address: string): Promise<bigint>;
  transfer(to: string, amount: bigint): Promise<ethers.ContractTransactionResponse>;
  approve(spender: string, amount: bigint): Promise<ethers.ContractTransactionResponse>;
  allowance(owner: string, spender: string): Promise<bigint>;
  transferFrom(from: string, to: string, amount: bigint): Promise<ethers.ContractTransactionResponse>;
}

export interface ProposalData {
  id: bigint;
  title: string;
  description: string;
  amount: bigint;
  recipient: string;
  creator: string;
  startTime: bigint;
  endTime: bigint;
  executed: boolean;
  cancelled: boolean;
  votesFor: bigint;
  votesAgainst: bigint;
}

export interface DAOEvents {
  ProposalCreated: {
    proposalId: bigint;
    title: string;
    creator: string;
    timestamp: bigint;
  };
  ProposalVoted: {
    proposalId: bigint;
    voter: string;
    support: boolean;
    timestamp: bigint;
  };
  ProposalExecuted: {
    proposalId: bigint;
    executor: string;
    timestamp: bigint;
  };
  ProposalCancelled: {
    proposalId: bigint;
    canceller: string;
    timestamp: bigint;
  };
  MemberJoined: {
    member: string;
    timestamp: bigint;
  };
  MemberLeft: {
    member: string;
    timestamp: bigint;
  };
  FundsDeposited: {
    member: string;
    amount: bigint;
    timestamp: bigint;
  };
  FundsWithdrawn: {
    member: string;
    amount: bigint;
    timestamp: bigint;
  };
}

export interface IdeaData {
  id: bigint;
  title: string;
  description: string;
  creator: string;
  hash: string;
  timestamp: bigint;
  similarityScore: number;
  royaltyRate: number;
  lastDistribution: number;
  totalDistributed: bigint;
}

export interface IdeaRegistryEvents {
  IdeaRegistered: {
    ideaId: bigint;
    title: string;
    creator: string;
    hash: string;
    timestamp: bigint;
  };
  IdeaReused: {
    originalIdeaId: bigint;
    newIdeaId: bigint;
    similarityScore: number;
    timestamp: bigint;
  };
  RoyaltyDistributed: {
    ideaId: bigint;
    amount: bigint;
    timestamp: bigint;
  };
}

export interface KnowledgeDomain {
  id: bigint;
  name: string;
  description: string;
  parentId: bigint | null;
  relevanceScore: number;
  innovationScore: number;
  contributionThreshold: bigint;
  totalContributions: bigint;
  activeProposals: bigint;
  timestamp: bigint;
}

export interface DomainMapping {
  domainId: bigint;
  proposalId: bigint;
  isPrimary: boolean;
  relevanceScore: number;
  timestamp: bigint;
}

export interface DomainAnalytics {
  domainId: bigint;
  totalProposals: bigint;
  activeProposals: bigint;
  totalContributions: bigint;
  innovationScore: number;
  growthRate: number;
  crossDomainInnovations: bigint;
}

export interface KnowledgeDomainEvents {
  DomainRegistered: {
    domainId: bigint;
    name: string;
    parentId: bigint | null;
    timestamp: bigint;
  };
  DomainUpdated: {
    domainId: bigint;
    relevanceScore: number;
    innovationScore: number;
    timestamp: bigint;
  };
  DomainMapped: {
    domainId: bigint;
    proposalId: bigint;
    isPrimary: boolean;
    timestamp: bigint;
  };
  DomainContribution: {
    domainId: bigint;
    amount: bigint;
    contributor: string;
    timestamp: bigint;
  };
}

export interface IConceptValues extends Contract {
  getValue(key: string): Promise<string>;
  setValue(key: string, value: string): Promise<void>;
}

export interface IConceptMapping extends Contract {
  mapValue(key: string, value: string): Promise<void>;
  getMappedValue(key: string): Promise<string>;
}

export interface ITripartiteComputations extends Contract {
  compute(input: string): Promise<string>;
  setComputationResult(input: string, result: string): Promise<void>;
}

export interface IDAOToken extends Contract {
  balanceOf(account: string): Promise<BigNumberish>;
  transfer(to: string, amount: BigNumberish): Promise<boolean>;
  approve(spender: string, amount: BigNumberish): Promise<boolean>;
}

export interface ILogicConstituent extends Contract {
  execute(input: string): Promise<void>;
  validate(input: string): Promise<boolean>;
}

export interface IStateConstituent extends Contract {
  getState(key: string): Promise<string>;
  setState(key: string, value: string): Promise<void>;
}

export interface IViewConstituent extends Contract {
  getView(key: string): Promise<string>;
  updateView(key: string, value: string): Promise<void>;
}

export interface ITripartiteProxy extends Contract {
  delegateCall(target: string, data: string): Promise<void>;
  getImplementation(): Promise<string>;
} 