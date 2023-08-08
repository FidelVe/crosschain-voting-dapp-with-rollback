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
  getVotesCapFromEVM,
  waitResponseMessageEventICON,
  waitRollbackMessageEventICON,
  getVotesFromICON,
  executeRollbackICON
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

    // filter CallMessageSent event
    const callMessageSentEvent = await filterCallMessageSentEvent(
      txResult.eventLogs
    );
    console.log("\n# CallMessageSent event:", callMessageSentEvent);

    // parse CallMessageSent event
    const parsedCallMessageSentEvent = await parseCallMessageSentEvent(
      callMessageSentEvent
    );
    console.log(
      "\n# parsed CallMessageSent event:",
      parsedCallMessageSentEvent
    );

    // _sn from source
    const snFromSource = parsedCallMessageSentEvent._sn;
    // filter CallMessage event evm
    const callMessageEventEvmFilters = filterCallMessageEventEvm(
      contracts.primary,
      contracts.secondary,
      snFromSource
    );
    const callMessageEventEvmFilters2 = filterCallMessageEventEvm(
      contracts.primary,
      contracts.secondary,
      null
    );
    console.log(
      "\n# CallMessage event evm filters:",
      callMessageEventEvmFilters
    );

    // wait for CallMessage event evm
    const eventsEvm = await waitEventEVM(
      callMessageEventEvmFilters,
      callMessageEventEvmFilters2
    );

    // fetch messageId from CallMessage event evm
    const messageId = eventsEvm[0].args._reqId;
    console.log("\n# Message ID:", messageId);

    // fetch data from CallMessage event evm
    const data = eventsEvm[0].args._data;
    console.log("\n# events params:");
    console.log(JSON.stringify(eventsEvm[0].args));

    // invoke execute call on destination chain
    console.log("\n# invoking execute call on destination chain");
    const executeCallTxHash = await executeCallEvm(messageId, data);
    console.log("\n# execute call tx hash:", executeCallTxHash.transactionHash);

    // filter CallExecuted event evm
    const callExecutedEventEvmFilters = filterCallExecutedEventEvm(messageId);
    console.log(
      "\n# callExecuted event evm filters:",
      callExecutedEventEvmFilters
    );

    // wait for CallExecuted event evm
    const eventsEvm2 = await waitEventEVM(callExecutedEventEvmFilters);
    console.log("\n# events params:");
    console.log(JSON.stringify(eventsEvm2[0].args));

    if (rollback) {
      // execute logic with rollback because current votes is equal or grater than votes cap
      // fetch ResponseMessage event on origin chain
      const responseMessageEvent = await waitResponseMessageEventICON(
        snFromSource
      );
      console.log("\n# ResponseMessage  event:", responseMessageEvent);
      // fetch RollbackMessage event on origin chain
      const rollbackMessageEvent = await waitRollbackMessageEventICON(
        snFromSource
      );
      console.log("\n# RollbackMessage  event:", rollbackMessageEvent);
      // fetch votes from origin chain before rollback
      const votesFromICONBeforeRollback = await getVotesFromICON(
        contracts.primary
      );
      console.log(
        "\n# votes from ICON before rollback:",
        votesFromICONBeforeRollback
      );
      // call the payable method executeRollback on the xcall contract of the origin chain
      console.log("\n# invoking executeRollback call on origin chain");
      const executeRollbackTxHash = await executeRollbackICON(
        rollbackMessageEvent.indexed[1]
      );
      // get tx result
      const executeRollbackTxResult = await getTxResult(executeRollbackTxHash);
      console.log(
        "\n# tx result for calling executeRollback:",
        executeRollbackTxResult.txHash
      );
      // fetch votes from origin chain after rollback
      const votesFromICONAfterRollback = await getVotesFromICON(
        contracts.primary
      );
      console.log(
        "\n# votes from ICON after rollback:",
        votesFromICONAfterRollback
      );
      // fetch votes from destination chain after rollback
      const votesFromEVM = await getVotesFromEVM(contracts.secondary);
      console.log("\n# votes from EVM:", votesFromEVM);
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
