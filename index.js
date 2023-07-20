// Imports
const {
  deployIcon,
  deployEvm,
  isDeployed,
  getDeployments,
  saveDeployments,
  voteYesFromIcon,
  getTxResult,
  filterCallMessageSentEvent,
  parseCallMessageSentEvent,
  filterCallMessageEventEvm,
  waitEventEVM,
  executeCallEvm,
  filterCallExecutedEventEvm,
  getVotesFromEVM,
  getVotesCapFromEVM
  // BigNumber
} = require("./utils/lib");

/*
 * Deploy script
 */
async function deploy() {
  try {
    const contracts = {
      primary: null,
      secondary: null
    };

    // deploying EVM contract
    const evmContractAddress = await deployEvm();
    console.log("\n# deployed EVM contract address:", evmContractAddress);

    // deploying ICON contract
    const iconContractAddress = await deployIcon(evmContractAddress);
    console.log("\n# deployed ICON contract address:", iconContractAddress);

    contracts.secondary = evmContractAddress;
    contracts.primary = iconContractAddress;
    return contracts;
  } catch (e) {
    console.log("error running deployments", e);
  }
}

/*
 * Tests
 * @param {Object} contracts
 * @param {string} contracts.primary - ICON contract address
 * @param {string} contracts.secondary - EVM contract address
 * @returns {Promise<void>}
 */
async function tests(contracts, rollback = false) {
  try {
    // vote yes from icon
    const voteYesFromIconResult = await voteYesFromIcon(contracts.primary);
    console.log("\n# vote yes from icon result:", voteYesFromIconResult);

    // get tx result
    const txResult = await getTxResult(voteYesFromIconResult);
    console.log("\n# tx result for calling voteYes:", txResult.txHash);

    // filter call message sent event
    const callMessageSentEvent = await filterCallMessageSentEvent(
      txResult.eventLogs
    );
    console.log("\n# call message sent event:", callMessageSentEvent);

    // parse call message sent event
    const parsedCallMessageSentEvent = await parseCallMessageSentEvent(
      callMessageSentEvent
    );
    console.log(
      "\n# parsed call message sent event:",
      parsedCallMessageSentEvent
    );

    // filter call message event evm
    const callMessageEventEvmFilters = filterCallMessageEventEvm(
      contracts.primary,
      contracts.secondary,
      parsedCallMessageSentEvent._sn
    );
    console.log(
      "\n# call message event evm filters:",
      callMessageEventEvmFilters
    );

    // wait for call message event evm
    const eventsEvm = await waitEventEVM(callMessageEventEvmFilters);
    const messageId = eventsEvm[0].args._reqId;
    const data = eventsEvm[0].args._data;
    console.log("\n# events params:");
    console.log(JSON.stringify(eventsEvm[0].args));

    // invoke execute call on destination chain
    console.log("\n# invoking execute call on destination chain");
    const executeCallTxHash = await executeCallEvm(messageId, data);
    console.log("\n# execute call tx hash:", executeCallTxHash.transactionHash);

    // filter call message event evm
    const callExecutedEventEvmFilters = filterCallExecutedEventEvm(messageId);
    console.log(
      "\n# callExecuted event evm filters:",
      callExecutedEventEvmFilters
    );

    // wait for call executed event evm
    const eventsEvm2 = await waitEventEVM(callExecutedEventEvmFilters);
    console.log("\n# events params:");
    console.log(JSON.stringify(eventsEvm2[0].args));

    if (!rollback) {
      // check votes from destination chain
      // const votesFromEVM = await getVotesFromEVM(contracts.secondary);
      // console.log("\n# votes from EVM:", votesFromEVM);
    } else {
      // execute logic with rollback because current votes is equal or grater than votes cap
      // fetch ResponseMessage event on origin chain
      // fetch RollbackMessage event on origin chain
      // call the payable method executeRollback on the xcall contract of the origin chain
      // fetch RollbackExecuted event on origin chain
    }
  } catch (e) {
    console.log("error running tests", e);
  }
}

/*
 * Main
 * @returns {Promise<void>}
 */
async function main() {
  try {
    // check if contracts have been deployed already
    let contracts = null;
    if (isDeployed()) {
      console.log("\n# using deployed contracts");
      contracts = getDeployments();
    } else {
      console.log("\n# deploying contracts");
      contracts = await deploy();
      saveDeployments(contracts);
    }

    if (contracts !== null) {
      console.log("\n# deployed contracts:", contracts);

      // check votes ledger on destination chain
      const votesFromEVM = await getVotesFromEVM(contracts.secondary);
      const votesCap = await getVotesCapFromEVM(contracts.secondary);
      const votesCapParsed = votesCap.toString();
      console.log("\n# votes cap from EVM:", votesCapParsed);

      const sum = votesFromEVM[0].add(votesFromEVM[1]).toString();
      console.log("\n# votes from EVM:", votesFromEVM);
      console.log("\n# sum of votes from EVM:", sum);

      for (let i = Number(sum); i < Number(votesCapParsed); i++) {
        // vote until votes cap is reached
        await tests(contracts);
      }

      // execute logic with rollback because current votes is equal or grater than votes cap
      await tests(contracts, true);
    }
  } catch (e) {
    console.log("error running main", e);
  }
}

main();
