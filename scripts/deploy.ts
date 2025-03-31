import { ethers } from "hardhat";
import { verify } from "./verify";

async function main() {
  // Get existing contract addresses from environment
  const conceptValues = process.env.VITE_CONTRACT_CONCEPT_VALUES;
  const conceptMapping = process.env.VITE_CONTRACT_CONCEPT_MAPPING;
  const tripartiteComputations = process.env.VITE_CONTRACT_TRIPARTITE_COMPUTATIONS;
  const daoToken = process.env.VITE_CONTRACT_DAO_TOKEN;
  const logicConstituent = process.env.VITE_CONTRACT_LOGIC_CONSTITUENT;
  const stateConstituent = process.env.VITE_CONTRACT_STATE_CONSTITUENT;
  const viewConstituent = process.env.VITE_CONTRACT_VIEW_CONSTITUENT;
  const tripartiteProxy = process.env.VITE_CONTRACT_TRIPARTITE_PROXY;

  if (!conceptValues || !conceptMapping || !tripartiteComputations || !daoToken || 
      !logicConstituent || !stateConstituent || !viewConstituent || !tripartiteProxy) {
    throw new Error("Missing required contract addresses in environment");
  }

  // Deploy GovernanceToken with multisig support
  const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
  const governanceToken = await GovernanceToken.deploy();
  await governanceToken.deployed();
  console.log("GovernanceToken deployed to:", governanceToken.address);

  // Deploy DAOGovernance with proxy
  const DAOGovernance = await ethers.getContractFactory("DAOGovernance");
  const daoGovernance = await upgrades.deployProxy(DAOGovernance, [
    governanceToken.address,
    process.env.ADMIN_ADDRESS,
    process.env.EMERGENCY_ADDRESS
  ]);
  await daoGovernance.deployed();
  console.log("DAOGovernance deployed to:", daoGovernance.address);

  // Initialize governance parameters based on environment variables
  const adminAllocationPercentage = parseFloat(process.env.VITE_ADMIN_TOKEN_ALLOCATION_PERCENTAGE || "7.407407407");
  const relayUptimeWeight = parseFloat(process.env.VITE_RELAY_UPTIME_WEIGHT || "0.6");
  const usersServedWeight = parseFloat(process.env.VITE_USERS_SERVED_WEIGHT || "0.4");
  const governanceActivityWeight = parseFloat(process.env.VITE_GOVERNANCE_ACTIVITY_WEIGHT || "1.0");
  const distributionInterval = parseInt(process.env.VITE_TOKEN_DISTRIBUTION_INTERVAL || "86400000");

  // Set up initial governance parameters
  const governanceParams = {
    proposalThreshold: ethers.utils.parseEther("1000"), // 1000 tokens
    quorum: ethers.utils.parseEther("10000"), // 10000 tokens
    votingDelay: 86400, // 1 day
    votingPeriod: 259200, // 3 days
    executionDelay: 86400, // 1 day
    minProposalVotingPower: ethers.utils.parseEther("100") // 100 tokens
  };

  await daoGovernance.updateParameters(governanceParams);

  // Set up rate limits for token operations
  const rateLimitParams = {
    maxAmount: ethers.utils.parseEther("1000000"), // 1M tokens
    timeWindow: 86400 // 1 day
  };

  await governanceToken.setRateLimit(
    daoGovernance.address,
    rateLimitParams.maxAmount,
    rateLimitParams.timeWindow
  );

  // Verify contracts on Etherscan
  if (process.env.ETHERSCAN_API_KEY) {
    await verify(governanceToken.address, []);
    await verify(daoGovernance.address, []);
  }

  // Log deployment information
  console.log("\nDeployment Summary:");
  console.log("------------------");
  console.log("GovernanceToken:", governanceToken.address);
  console.log("DAOGovernance:", daoGovernance.address);
  console.log("Concept Values:", conceptValues);
  console.log("Concept Mapping:", conceptMapping);
  console.log("Tripartite Computations:", tripartiteComputations);
  console.log("DAO Token:", daoToken);
  console.log("Logic Constituent:", logicConstituent);
  console.log("State Constituent:", stateConstituent);
  console.log("View Constituent:", viewConstituent);
  console.log("Tripartite Proxy:", tripartiteProxy);
  console.log("\nGovernance Parameters:");
  console.log("---------------------");
  console.log("Admin Allocation:", adminAllocationPercentage + "%");
  console.log("Relay Uptime Weight:", relayUptimeWeight);
  console.log("Users Served Weight:", usersServedWeight);
  console.log("Governance Activity Weight:", governanceActivityWeight);
  console.log("Distribution Interval:", distributionInterval + "ms");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 