const { ethers } = require("hardhat");
const fs = require("fs");

async function deployContract(admin, ContractFactory) {
  const deployTx = await ContractFactory.getDeployTransaction();
  const txResponse = await admin.sendTransaction(deployTx);
  const receipt = await txResponse.wait();

  if (!receipt.contractAddress) throw new Error("Contract deployment failed.");
  return ContractFactory.attach(receipt.contractAddress);
}

const latestGasUsedFromBlock = async (senderAddress) => {
  const latestBlock = await ethers.provider.getBlock("latest", true);
  const txHashes = latestBlock.transactions;
  const txs = await Promise.all(txHashes.map(hash => ethers.provider.getTransaction(hash)));
  const lastUserTx = txs.reverse().find(tx => tx.from.toLowerCase() === senderAddress.toLowerCase());

  if (!lastUserTx || !lastUserTx.hash) {
    console.warn("No matching transaction from sender in the latest block.");
    return 0;
  }

  const receipt = await ethers.provider.getTransactionReceipt(lastUserTx.hash);
  return Number(receipt.gasUsed);
};

async function setResources(contract, admin, activityToRole, roleToSigner) {
  for (const role of new Set(Object.values(activityToRole))) {
    const signer = roleToSigner[role];
    await contract.connect(admin).setResource(role, await signer.getAddress());
  }
}

async function setStockAndPrice(contract, admin, stockLevels, itemPrices) {
  for (let i = 0; i < stockLevels.length; i++) {
    await contract.connect(admin).setStock(i + 1, stockLevels[i]);
    await contract.connect(admin).setPrice(i + 1, ethers.parseEther(itemPrices[i].toString()));
  }
}

async function fundContract(contract, signer, amount) {
  const tx = await contract.connect(signer).Activity_0fun8ap({
    value: ethers.parseEther(amount.toString()),
  });

  const receipt = await tx.wait();

  return {gasUsed: Number(receipt.gasUsed), gasPrice: receipt.gasPrice};
}

async function attemptOrderPartial(contract, trace, roleToSigner, activityToRole, orderId = 0) {
  let unavailableItems = [];
  let gasUsedByAttempt = [];
  let totalGasUsed = 0;
  let totalGasTotal = 0;
  let txCount = 0;

  for (let i = 0; i < trace.attempts.length; i++) {
    const attempt = trace.attempts[i];
    const isFirst = i === 0;
    const activity = isFirst ? "Activity_0niv12y" : "Activity_1vaacll";
    const signer = roleToSigner[activityToRole[activity]];
    const itemIds = isFirst ? attempt.itemIds : unavailableItems.map(Number);

    if (itemIds.length === 0) break;

    const quantities = isFirst
      ? attempt.quantities
      : itemIds.map(id => attempt.quantities[attempt.itemIds.indexOf(id)]);

    let total = itemIds.reduce((sum, id, idx) =>
      sum + trace.itemPrices[id - 1] * quantities[idx], 0) + 0.1;

    const balanceSufficient = trace.balanceSufficient;
    // If balanceSufficient is false, simulate a failed transaction by setting total to 0
    if (!balanceSufficient) {
      total = 0;
    }

    // Now check if the transaction is going to fail due to insufficient balance
    try {
      const tx = await contract.connect(signer)[activity](
        ...(isFirst
          ? [itemIds, quantities, trace.domestic, trace.deliveryAddress]
          : [orderId, itemIds, quantities]),
        { value: ethers.parseEther(total.toString()) }
      );


      const receipt = await tx.wait();
      const gasUsed = Number(receipt.gasUsed);
      gasUsedByAttempt.push(gasUsed);
      totalGasUsed += gasUsed;
      totalGasTotal += gasUsed * Number(receipt.gasPrice); 
      txCount++;

      const parsedEvents = receipt.logs.map(log => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      }).filter(Boolean);

      let foundEvent = parsedEvents.find(e => e.name === "Event_15b3i41");
      if (foundEvent) {
        unavailableItems = itemIds.filter(item =>
          foundEvent.args.unavailableItemIds.map(x => x.toString()).includes(item.toString()));
        orderId = foundEvent.args.orderId;
      } else {
        break;
      }
    } catch (error) {
      // Handle the insufficient balance case or any other error
      const fallbackGasUsed = await latestGasUsedFromBlock(signer.address);
      gasUsedByAttempt.push(fallbackGasUsed);
      totalGasUsed += fallbackGasUsed;
      txCount++;

      // If balance is insufficient, we simply break out of the loop
      if (!balanceSufficient) {
        break; // Stop further attempts since the balance is insufficient
      }
    }
  }

  return { orderId, totalGasUsed, gasUsedByAttempt, txCount, gasPrice: totalGasTotal };
}

async function attemptOrderFullResend(contract, trace, roleToSigner, activityToRole, orderId = 0) {
  const signer = roleToSigner[activityToRole["Activity_0niv12y"]];
  let totalGasUsed = 0;
  let gasUsedByAttempt = [];
  let txCount = 0;

  for (let i = 0; i < trace.attempts.length; i++) {
    const attempt = trace.attempts[i];
    const itemIds = attempt.itemIds;
    const quantities = attempt.quantities;

    let total = itemIds.reduce((sum, id, idx) =>
      sum + trace.itemPrices[id - 1] * quantities[idx], 0) + 0.1;

    const balanceSufficient = trace.balanceSufficient;
    // If balanceSufficient is false, simulate a failed transaction by setting total to 0
    if (!balanceSufficient) {
      total = 0;
    }

    // Check if balance is insufficient and proceed with the failed transaction attempt
    const data = contract.interface.encodeFunctionData("Activity_0niv12y", [
      itemIds,
      quantities,
      trace.domestic,
      trace.deliveryAddress,
    ]);

    const txRequest = {
      to: contract.target,
      data: data,
      value: ethers.parseEther(total.toString()),
      from: signer.address,
      gasLimit: 30000000,
    };

    try {
      const tx = await signer.sendTransaction(txRequest);
      const receipt = await tx.wait();
      const gasUsed = Number(receipt.gasUsed);
      gasUsedByAttempt.push(gasUsed);
      totalGasUsed += gasUsed;
      txCount++;
      return { orderId: orderId, totalGasUsed, gasUsedByAttempt, txCount, gasPrice: receipt.gasPrice };
    } catch (error) {
      // Fallback gas usage (since the tx is going to fail due to insufficient balance)
      const fallbackGasUsed = await latestGasUsedFromBlock(signer.address);
      gasUsedByAttempt.push(fallbackGasUsed);
      totalGasUsed += fallbackGasUsed;
      txCount++;

      // If balance is insufficient, we simply break out of the loop
      if (!balanceSufficient) {
        break; // Stop further attempts since the balance is insufficient
      }
    }
  }

  return { orderId: orderId, totalGasUsed, gasUsedByAttempt, txCount};
}

async function handleCustoms(contract, trace, orderId, roleToSigner, activityToRole) {
  if (trace.domestic) return { gasUsed: 0, txCount: 0 };

  const customs = roleToSigner[activityToRole["Activity_0k0x70l"]];
  const tx = await contract.connect(customs).Activity_0k0x70l(orderId);
  const receipt = await tx.wait();
  return { gasUsed: Number(receipt.gasUsed), txCount: 1, gasPrice: receipt.gasPrice };
}

async function handleDelivery(contract, orderId, roleToSigner, activityToRole) {
  const logistics = roleToSigner[activityToRole["Activity_1hhx3o3"]];
  const tx = await contract.connect(logistics).Activity_1hhx3o3(orderId);
  const receipt = await tx.wait();
  return { gasUsed: Number(receipt.gasUsed), txCount: 1, gasPrice: receipt.gasPrice };
}

// async function handleRefund(contract, orderId, roleToSigner, activityToRole) {
//   const retailer = roleToSigner[activityToRole["Activity_0nflsru"]];
//   const tx = await contract.connect(retailer).Activity_0nflsru();
//   const receipt = await tx.wait();
//   return { gasUsed: Number(receipt.gasUsed), txCount: 1 };
// }


async function handleRefund(contract, orderId, roleToSigner, activityToRole, fundDistribution) {
  const retailer = roleToSigner[activityToRole["Activity_0nflsru"]];

  // Call the refund function
  const tx = await contract.connect(retailer).Activity_0nflsru();
  const receipt = await tx.wait();

  // Process the RefundEvent logs to track refunds
  const parsedEvents = receipt.logs.map(log => {
    try {
      return contract.interface.parseLog(log);
    } catch {
      return null;
    }
  }).filter(Boolean);

  // Track refund amounts for each user
  parsedEvents.forEach(event => {
    if (event.name === "RefundEvent") {
      const user = event.args.user;
      const refundAmount = ethers.formatEther(event.args.amountRefunded);  // Refund amount in Ether
      // const refundAmount = event.args.amountRefunded;
      // console.log(user, event.args.amountRefunded)
      fundDistribution.refundedAmount[user] = fundDistribution.refundedAmount[user] || 0;
      fundDistribution.refundedAmount[user] += parseFloat(refundAmount);  // Track total refund per user
    }
  });

  return { gasUsed: Number(receipt.gasUsed), txCount: 1, gasPrice: receipt.gasPrice };
}

async function processTraceWithContract(trace, contractName, attemptFn, roleToSigner, activityToRole, admin, isFull) {
  console.log(`\n=== [${trace.trace_id}] Using contract: ${contractName} ===`);

  const ContractFactory = await ethers.getContractFactory(contractName);
  const contract = await deployContract(admin, ContractFactory);

  await setResources(contract, admin, activityToRole, roleToSigner);
  await setStockAndPrice(contract, admin, trace.stockLevels, trace.itemPrices);

  let fundDistribution = {
    fundedAmount: {},
    refundedAmount: {},  // This will track refunded amounts by user
    gasUsedByParticipant: {},  // This will track the gas used by each participant
  };

  let gasByFunction = {
    fundContract: 0,
    attemptFn: 0,
    customsClearance: 0,
    orderDelivered: 0,
  };
  let txCount = 0;

  if (isFull) {
    const funder = roleToSigner[activityToRole["Activity_0fun8ap"]];
    const { gasUsed: fundGas, gasPrice: fundGasPrice }  = await fundContract(contract, funder, trace.fundingAmount);
    gasByFunction.fundContract = fundGas;
    fundDistribution.gasUsedByParticipant["retailer"] = fundGas * Number(fundGasPrice);
    fundDistribution.fundedAmount["retailer"] = trace.fundingAmount;
    txCount++;
  }

  const { orderId, totalGasUsed: attemptGas, gasUsedByAttempt, txCount: attemptTxCount, gasPrice: attemptGasPrice } = await attemptFn(
    contract, trace, roleToSigner, activityToRole
  );

  gasByFunction.attemptFn = attemptGas;
  fundDistribution.gasUsedByParticipant["customer"] = Number(attemptGasPrice);
  txCount += attemptTxCount;

  if (trace.balanceSufficient) {

    const { gasUsed: customsGas, txCount: customsTx, gasPrice: handleGasPrice } = await handleCustoms(contract, trace, orderId, roleToSigner, activityToRole);
    gasByFunction.customsClearance = customsGas;
    fundDistribution.gasUsedByParticipant["customs"] = customsGas * Number(handleGasPrice);
    txCount += customsTx;

    const { gasUsed: deliveryGas, txCount: deliveryTx, gasPrice: deliveryGasPrice } = await handleDelivery(contract, orderId, roleToSigner, activityToRole);
    gasByFunction.orderDelivered = deliveryGas;
    fundDistribution.gasUsedByParticipant["logistics"] = deliveryGas * Number(deliveryGasPrice);
    txCount += deliveryTx;

    if (isFull) {
      const { gasUsed: refundGas, txCount: refundTx, gasPrice: refundGasPrice } = await handleRefund(contract, orderId, roleToSigner, activityToRole, fundDistribution);
      gasByFunction.refundGas = refundGas;
      fundDistribution.gasUsedByParticipant["retailer"] = refundGas * Number(refundGasPrice);
      txCount += refundTx;
    }

  }

  const totalGasUsed = Object.values(gasByFunction).reduce((a, b) => a + b, 0);

  return {
    traceNumber: trace.trace_id,
    numItems: trace.attempts[0].itemIds.length,
    gasByFunction,
    totalGasUsed,
    txCount,
    gasUsedByAttempt,
    fundDistribution
  };
}

async function main() {


  const gasPrice = (await ethers.provider.getFeeData()).gasPrice;
  console.log(gasPrice)



  const data = JSON.parse(fs.readFileSync("./traces.json"));
  const traces = data.traces;

  const signers = await ethers.getSigners();
  const admin = signers[0];

  const roleToSigner = {
    "Retailer": signers[1],
    "Customer": signers[2],
    "Customs": signers[3],
    "Logistics": signers[4],
  };

  const activityToRole = {
    "Activity_0fun8ap": "Retailer",
    "Activity_0niv12y": "Customer",
    "Activity_1vaacll": "Customer",
    "Activity_0k0x70l": "Customs",
    "Activity_1hhx3o3": "Logistics",
    "Activity_0nflsru": "Retailer",
  };

  const stats = {
    full: {
      traceDetails: [],
      totalTransactions: 0,
      totalGasUsed: 0,
      totalItems: 0,
      totalGasByFunction: {
        fundContract: 0,
        attemptFn: 0,
        customsClearance: 0,
        orderDelivered: 0,
        refundGas: 0,
      },
      totalFundedAmount: {},
      totalRefundedAmount: {},
      totalGasUsedByParticipant: {},
    },
    base: {
      traceDetails: [],
      totalTransactions: 0,
      totalGasUsed: 0,
      totalItems: 0,
      totalGasByFunction: {
        fundContract: 0,
        attemptFn: 0,
        customsClearance: 0,
        orderDelivered: 0,
        refundGas: 0,
      },
      totalFundedAmount: {},
      totalRefundedAmount: {},
      totalGasUsedByParticipant: {},
    },
  };

  // Process all traces
  for (const trace of traces) {
    const fullRes = await processTraceWithContract(
      trace,
      "Process_1_DefaultContract_Participant_0bc7qxq_Collaboration_81674242",
      attemptOrderPartial,
      roleToSigner,
      activityToRole,
      admin,
      true
    );
    stats.full.traceDetails.push(fullRes);

    stats.full.totalTransactions += fullRes.txCount;
    stats.full.totalGasUsed += fullRes.totalGasUsed;
    stats.full.totalItems += trace.stockLevels.length;
    Object.keys(fullRes.gasByFunction).forEach((key) => {
      stats.full.totalGasByFunction[key] += fullRes.gasByFunction[key];
    });

    for (const [user, amount] of Object.entries(fullRes.fundDistribution.fundedAmount)) {
      if (Object.keys(fullRes.fundDistribution.refundedAmount).length === 0){continue;}
      stats.full.totalFundedAmount[user] = (stats.full.totalFundedAmount[user] || 0) + amount;
    }

    for (const [user, amount] of Object.entries(fullRes.fundDistribution.refundedAmount)) {
      stats.full.totalRefundedAmount[user] = (stats.full.totalRefundedAmount[user] || 0) + amount;
    }

    for (const [user, gas] of Object.entries(fullRes.fundDistribution.gasUsedByParticipant)) {
      stats.full.totalGasUsedByParticipant[user] = (stats.full.totalGasUsedByParticipant[user] || 0) + gas;
    }

    const baseRes = await processTraceWithContract(
      trace,
      "Process_1_DefaultContract_Participant_0bc7qxq_Collaboration_81674243",
      attemptOrderFullResend,
      roleToSigner,
      activityToRole,
      admin,
      false
    );
    stats.base.traceDetails.push(baseRes);

    stats.base.totalTransactions += baseRes.txCount;
    stats.base.totalGasUsed += baseRes.totalGasUsed;
    stats.base.totalItems += trace.stockLevels.length;
    Object.keys(baseRes.gasByFunction).forEach((key) => {
      stats.base.totalGasByFunction[key] += baseRes.gasByFunction[key];
    });

    for (const [user, amount] of Object.entries(baseRes.fundDistribution.fundedAmount)) {
      stats.base.totalFundedAmount[user] = (stats.base.totalFundedAmount[user] || 0) + amount;
    }
    for (const [user, amount] of Object.entries(baseRes.fundDistribution.refundedAmount)) {
      stats.base.totalRefundedAmount[user] = (stats.base.totalRefundedAmount[user] || 0) + amount;
    }

    for (const [user, gas] of Object.entries(baseRes.fundDistribution.gasUsedByParticipant)) {
      stats.base.totalGasUsedByParticipant[user] = (stats.base.totalGasUsedByParticipant[user] || 0) + gas;
    }

  }

  // Calculate averages for full and base stats
  const calculateAverages = (statType) => {
    const totalTransactions = stats[statType].totalTransactions;
    const totalGasByFunction = stats[statType].totalGasByFunction;
    const totalGasUsed = stats[statType].totalGasUsed;

    const averageGasByFunction = {};
    Object.keys(totalGasByFunction).forEach((key) => {
      averageGasByFunction[key] = totalGasByFunction[key] / totalTransactions;
    });

    return {
      totalTransactions,
      averageGasByFunction,
      totalGasUsed,
      averageGasUsedPerTransaction: totalGasUsed / totalTransactions,
    };
  };

  const fullStats = calculateAverages("full");
  const baseStats = calculateAverages("base");

  const comparisonStats = {
    full: fullStats,
    base: baseStats,
    comparison: {
      totalTransactions: fullStats.totalTransactions - baseStats.totalTransactions,
      totalGasUsed: fullStats.totalGasUsed - baseStats.totalGasUsed,
      avgGasByFunction: Object.keys(fullStats.averageGasByFunction).reduce((acc, key) => {
        acc[key] = fullStats.averageGasByFunction[key] - baseStats.averageGasByFunction[key];
        return acc;
      }, {}),
      avgGasUsedPerTransaction: fullStats.averageGasUsedPerTransaction - baseStats.averageGasUsedPerTransaction,
    },
  };

  stats.comparison = comparisonStats;


  // Write stats to a JSON file
  fs.writeFileSync("gas-stats.json", JSON.stringify({ stats }, null, 2));

  console.log("\n=== Gas stats written to gas-stats.json ===");
  console.log("\n=== Comparison stats: ===");
  console.log(comparisonStats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
