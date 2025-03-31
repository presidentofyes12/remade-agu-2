import { ethers, ContractRunner, BaseContract } from 'ethers';
import { WalletConnector } from '../wallet/WalletConnector';
import { KeyManager } from '../wallet/KeyManager';

declare global {
  interface Window {
    ethereum: any;
  }
}

export class ContractInterface {
  private static instance: ContractInterface | null = null;
  private provider: ethers.BrowserProvider;
  private signer: ethers.JsonRpcSigner | null = null;
  private conceptValues!: BaseContract & { runner: ContractRunner };
  private conceptMapping!: BaseContract & { runner: ContractRunner };
  private tripartiteComputations!: BaseContract & { runner: ContractRunner };
  private daoToken!: BaseContract & { runner: ContractRunner };
  private logicConstituent!: BaseContract & { runner: ContractRunner };
  private stateConstituent!: BaseContract & { runner: ContractRunner };
  private viewConstituent!: BaseContract & { runner: ContractRunner };
  private tripartiteProxy!: BaseContract & { runner: ContractRunner };

  private constructor(provider: ethers.BrowserProvider) {
    this.provider = provider;
    this.initializeContracts();
  }

  private initializeContracts(): void {
    // Initialize contracts with provider
    this.conceptValues = new ethers.Contract(
      process.env.REACT_APP_CONCEPT_VALUES_ADDRESS || '',
      [
        'function getValue(bytes32 key) view returns (bytes32)',
        'function setValue(bytes32 key, bytes32 value)',
      ],
      this.provider
    ) as BaseContract & { runner: ContractRunner };
    
    this.conceptMapping = new ethers.Contract(
      process.env.REACT_APP_CONCEPT_MAPPING_ADDRESS || '',
      [
        'function mapValue(bytes32 key, bytes32 value)',
        'function getMappedValue(bytes32 key) view returns (bytes32)',
      ],
      this.provider
    ) as BaseContract & { runner: ContractRunner };
    
    this.tripartiteComputations = new ethers.Contract(
      process.env.REACT_APP_TRIPARTITE_COMPUTATIONS_ADDRESS || '',
      [
        'function compute(bytes32 input) view returns (bytes32)',
        'function setComputationResult(bytes32 input, bytes32 result)',
      ],
      this.provider
    ) as BaseContract & { runner: ContractRunner };
    
    this.daoToken = new ethers.Contract(
      process.env.REACT_APP_DAO_TOKEN_ADDRESS || '',
      [
        'function balanceOf(address account) view returns (uint256)',
        'function transfer(address to, uint256 amount) returns (bool)',
        'function approve(address spender, uint256 amount) returns (bool)',
      ],
      this.provider
    ) as BaseContract & { runner: ContractRunner };

    this.logicConstituent = new ethers.Contract(
      process.env.REACT_APP_LOGIC_CONSTITUENT_ADDRESS || '',
      [
        'function execute(bytes32 input)',
        'function validate(bytes32 input) view returns (bool)',
      ],
      this.provider
    ) as BaseContract & { runner: ContractRunner };

    this.stateConstituent = new ethers.Contract(
      process.env.REACT_APP_STATE_CONSTITUENT_ADDRESS || '',
      [
        'function getState(bytes32 key) view returns (bytes32)',
        'function setState(bytes32 key, bytes32 value)',
      ],
      this.provider
    ) as BaseContract & { runner: ContractRunner };

    this.viewConstituent = new ethers.Contract(
      process.env.REACT_APP_VIEW_CONSTITUENT_ADDRESS || '',
      [
        'function getView(bytes32 key) view returns (bytes32)',
        'function updateView(bytes32 key, bytes32 value)',
      ],
      this.provider
    ) as BaseContract & { runner: ContractRunner };

    this.tripartiteProxy = new ethers.Contract(
      process.env.REACT_APP_TRIPARTITE_PROXY_ADDRESS || '',
      [
        'function delegateCall(address target, bytes data)',
        'function getImplementation() view returns (address)',
      ],
      this.provider
    ) as BaseContract & { runner: ContractRunner };
  }

  public static getInstance(provider: ethers.BrowserProvider): ContractInterface {
    if (!ContractInterface.instance) {
      ContractInterface.instance = new ContractInterface(provider);
    }
    return ContractInterface.instance;
  }

  public async connect(signer: ethers.JsonRpcSigner): Promise<void> {
    this.signer = signer;
    
    // Connect contracts with signer
    this.conceptValues = this.conceptValues.connect(signer) as BaseContract & { runner: ContractRunner };
    this.conceptMapping = this.conceptMapping.connect(signer) as BaseContract & { runner: ContractRunner };
    this.tripartiteComputations = this.tripartiteComputations.connect(signer) as BaseContract & { runner: ContractRunner };
    this.daoToken = this.daoToken.connect(signer) as BaseContract & { runner: ContractRunner };
    this.logicConstituent = this.logicConstituent.connect(signer) as BaseContract & { runner: ContractRunner };
    this.stateConstituent = this.stateConstituent.connect(signer) as BaseContract & { runner: ContractRunner };
    this.viewConstituent = this.viewConstituent.connect(signer) as BaseContract & { runner: ContractRunner };
    this.tripartiteProxy = this.tripartiteProxy.connect(signer) as BaseContract & { runner: ContractRunner };
  }

  public disconnect(): void {
    this.signer = null;
    
    // Reconnect contracts with provider
    this.conceptValues = this.conceptValues.connect(this.provider) as BaseContract & { runner: ContractRunner };
    this.conceptMapping = this.conceptMapping.connect(this.provider) as BaseContract & { runner: ContractRunner };
    this.tripartiteComputations = this.tripartiteComputations.connect(this.provider) as BaseContract & { runner: ContractRunner };
    this.daoToken = this.daoToken.connect(this.provider) as BaseContract & { runner: ContractRunner };
    this.logicConstituent = this.logicConstituent.connect(this.provider) as BaseContract & { runner: ContractRunner };
    this.stateConstituent = this.stateConstituent.connect(this.provider) as BaseContract & { runner: ContractRunner };
    this.viewConstituent = this.viewConstituent.connect(this.provider) as BaseContract & { runner: ContractRunner };
    this.tripartiteProxy = this.tripartiteProxy.connect(this.provider) as BaseContract & { runner: ContractRunner };
  }

  public getConceptValues(): BaseContract & { runner: ContractRunner } {
    return this.conceptValues;
  }

  public getConceptMapping(): BaseContract & { runner: ContractRunner } {
    return this.conceptMapping;
  }

  public getTripartiteComputations(): BaseContract & { runner: ContractRunner } {
    return this.tripartiteComputations;
  }

  public getDAOToken(): BaseContract & { runner: ContractRunner } {
    return this.daoToken;
  }

  public getLogicConstituent(): BaseContract & { runner: ContractRunner } {
    return this.logicConstituent;
  }

  public getStateConstituent(): BaseContract & { runner: ContractRunner } {
    return this.stateConstituent;
  }

  public getViewConstituent(): BaseContract & { runner: ContractRunner } {
    return this.viewConstituent;
  }

  public getTripartiteProxy(): BaseContract & { runner: ContractRunner } {
    return this.tripartiteProxy;
  }

  public getSigner(): ethers.JsonRpcSigner | null {
    return this.signer;
  }

  public getProvider(): ethers.BrowserProvider {
    return this.provider;
  }

  async getConceptValue(key: string): Promise<string> {
    const keyHash = ethers.keccak256(ethers.toUtf8Bytes(key));
    const value = await this.conceptValues.getValue(keyHash);
    return ethers.toUtf8String(value);
  }

  async mapConceptValue(key: string, value: string): Promise<void> {
    const keyHash = ethers.keccak256(ethers.toUtf8Bytes(key));
    const valueHash = ethers.keccak256(ethers.toUtf8Bytes(value));
    await this.conceptMapping.mapValue(keyHash, valueHash);
  }

  async getMappedValue(key: string): Promise<string> {
    const keyHash = ethers.keccak256(ethers.toUtf8Bytes(key));
    const value = await this.conceptMapping.getMappedValue(keyHash);
    return ethers.toUtf8String(value);
  }

  async getBalance(account: string): Promise<bigint> {
    return await this.daoToken.balanceOf(account);
  }

  async transfer(to: string, amount: bigint): Promise<boolean> {
    return await this.daoToken.transfer(to, amount);
  }

  async approve(spender: string, amount: bigint): Promise<boolean> {
    return await this.daoToken.approve(spender, amount);
  }

  // Helper method to get contract instance
  getContract(address: string, abi: any[]): ethers.Contract {
    return new ethers.Contract(address, abi, this.ensureSigner());
  }

  // Helper method to encode function call
  encodeFunctionCall(contract: ethers.Contract, functionName: string, args: any[]): string {
    return contract.interface.encodeFunctionData(functionName, args);
  }

  // Helper method to decode function result
  decodeFunctionResult(contract: ethers.Contract, functionName: string, data: string): any {
    return contract.interface.decodeFunctionResult(functionName, data);
  }

  private ensureSigner() {
    if (!this.signer) {
      throw new Error('Signer not initialized');
    }
    return this.signer;
  }
} 