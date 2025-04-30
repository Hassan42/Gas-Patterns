const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  // Load the JSON data
  const data = JSON.parse(fs.readFileSync("./traces.json"));
  const traces = data.traces;

  // Get signers
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

  for (const trace of traces) {
    console.log("Processing trace:", trace.trace_id);

    // Deploy the contract
    const ContractFactory = await ethers.getContractFactory("Process_1_DefaultContract_Participant_0bc7qxq_Collaboration_81674242");
    const deployTransaction = await ContractFactory.getDeployTransaction();
    const txResponse = await admin.sendTransaction(deployTransaction);
    const receipt = await txResponse.wait();

    const contractAddress = receipt.contractAddress;
    if (!contractAddress) {
      throw new Error("Contract deployment failed.");
    }
    console.log(`Contract deployed at: ${contractAddress}`);

    const contract = ContractFactory.attach(contractAddress);

    // Set resources
    for (const [activity, role] of Object.entries(activityToRole)) {
      const signer = roleToSigner[role];
      await contract.connect(admin).setResource(role, await signer.getAddress());
    }

    // Set stock and price
    for (let i = 0; i < trace.stockLevels.length; i++) {
      await contract.connect(admin).setStock(i + 1, trace.stockLevels[i]);
      await contract.connect(admin).setPrice(i + 1, ethers.parseEther(trace.itemPrices[i].toString()));
    }

    // Fund contract
    const funder = roleToSigner[activityToRole["Activity_0fun8ap"]];
    const fundTx = await contract.connect(funder).Activity_0fun8ap({
      value: ethers.parseEther(trace.fundingAmount.toString()),
    });
    await fundTx.wait();

    let eventEmitted = false;
    let orderId = 0; // always 0 since we are dealing with 1 order in each trace and one contract for each trace

    // Attempt order with retries
    for (let i = 0; i < trace.attempts.length; i++) {
      const attempt = trace.attempts[i];
      const isFirstAttempt = i === 0;
      const activity = isFirstAttempt ? "Activity_0niv12y" : "Activity_1vaacll";
      const signer = roleToSigner[activityToRole[activity]];
      const itemsToSend = isFirstAttempt ? attempt.itemIds : unavailableItems.map(i => parseInt(i));

      if (itemsToSend.length === 0) break;

      let tx;
      if (isFirstAttempt) {

        const totalValue = itemsToSend.reduce((sum, itemId, index) => {
          const itemIndex = itemId - 1;
          return sum + trace.itemPrices[itemIndex] * attempt.quantities[index];
        }, 0) + 0.01;

        tx = await contract.connect(signer).Activity_0niv12y(
          itemsToSend,
          attempt.quantities,
          trace.domestic,
          trace.deliveryAddress,
          { value: ethers.parseEther(totalValue.toString()) }
        );
      } else {
        // Trim quantities to match filtered itemIds
        const trimmedQuantities = itemsToSend.map(itemId => {
          const index = attempt.itemIds.indexOf(itemId);
          return attempt.quantities[index];
        });

        const partialValue = itemsToSend.reduce((sum, itemId, index) => {
          const itemIndex = itemId - 1;
          return sum + trace.itemPrices[itemIndex] * trimmedQuantities[index];
        }, 0) + 0.01; // 0.01 off-chain value is off for some reason

        tx = await contract.connect(signer).Activity_1vaacll(
          orderId,
          itemsToSend,
          trimmedQuantities,
          { value: ethers.parseEther(partialValue.toString()) }
        );
      }

      const receipt = await tx.wait();
      if (!receipt || !receipt.logs) {
        console.log("No logs found in receipt.");
        break;
      }

      // Parse logs manually
      const parsedEvents = receipt.logs
        .map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch (e) {
            return null;
          }
        })
        .filter((e) => e !== null);

      for (const event of parsedEvents) {
        if (event.name === "Event_15b3i41") {
          const rawUnavailable = event.args.unavailableItemIds;
          unavailableItems = itemsToSend.filter(item =>
            rawUnavailable.map(x => x.toString()).includes(item.toString())
          );
          orderId = event.args.orderId;
          eventEmitted = true;
        }
      }

      if (!eventEmitted) break;
      eventEmitted = false;
    }

    // const items = await contract.getOrderItems(0);
    // console.log("Order Items:", items);

    //Customs clearance
    if (!trace.domestic) {
      const customs = roleToSigner[activityToRole["Activity_0k0x70l"]];
      await (await contract.connect(customs).Activity_0k0x70l(orderId)).wait();
    }

    //Delivery confirmation
    const logistics = roleToSigner[activityToRole["Activity_1hhx3o3"]];
    await (await contract.connect(logistics).Activity_1hhx3o3(orderId)).wait();

  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
