const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const deployments = {};

  const contractsToDeploy = [
    "Base",
    "EventLogging",
    "GuardCheck",
    "PartialRecovery",
    "RefundGas",
    "Process_1_DefaultContract_Participant_0bc7qxq_Collaboration_81674242"
  ];

  const [admin] = await ethers.getSigners(); // Get deployer signer

  // First, deploy all contracts and collect data
  for (const contractName of contractsToDeploy) {
    console.log(`Preparing deployment for ${contractName}...`);
    
    const ContractFactory = await ethers.getContractFactory(contractName);
    const deployTransaction = await ContractFactory.getDeployTransaction();
    const txResponse = await admin.sendTransaction(deployTransaction);
    const receipt = await txResponse.wait();
    
    const contractAddress = receipt.contractAddress;
    const gasUsed = receipt.gasUsed.toString(); // gasUsed is BigNumber -> toString()

    console.log(`${contractName} deployed at ${contractAddress} using ${gasUsed} gas`);

    deployments[contractName] = {
      address: contractAddress,
      gasUsed: gasUsed // store as string first
    };
  }

  // Second, compute differences compared to Base
  const baseGasUsed = BigInt(deployments["Base"].gasUsed);

  for (const [name, info] of Object.entries(deployments)) {
    const gasUsed = BigInt(info.gasUsed);
    const gasDifference = gasUsed - baseGasUsed;

    deployments[name].diffFromBase = gasDifference.toString(); // Add the diff field
  }

  fs.writeFileSync('deployment_gas_report.json', JSON.stringify({ deployments }, null, 2));

  console.log(`\nDeployment gas report saved.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
