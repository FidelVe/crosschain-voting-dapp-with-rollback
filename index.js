// Imports
const {
  deployIcon,
  deployEvm,
  isDeployed,
  getDeployments,
  saveDeployments,
  voteYesFromIcon,
  // voteNoFromIcon,
  getTxResult,
  filterCallMessageSentEvent,
  parseCallMessageSentEvent,
  filterCallMessageEventEvm,
  waitEventEVM,
  executeCallEvm
  // checkCallExecutedEventEvm
} = require("./lib");

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

async function tests(contracts) {
  try {
    // vote yes from icon
    const voteYesFromIconResult = await voteYesFromIcon(contracts.primary);
    console.log("\n# vote yes from icon result:", voteYesFromIconResult);

    // get tx result
    const txResult = await getTxResult(voteYesFromIconResult);
    console.log("\n# tx result for calling voteYes:", txResult);

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
    const messageId = eventsEvm[0].args._from;
    const sn = eventsEvm[0].args._sn;
    console.log("\n# events params:");
    console.log("_from:", eventsEvm[0].args._from);
    console.log("_to:", eventsEvm[0].args._to);
    console.log("_ReqId:", messageId);
    console.log("_sn:", sn);

    // invoke execute call on destination chain
    console.log("\n# invoking execute call on destination chain");
    const executeCallTxHash = await executeCallEvm(messageId);
    console.log("\n# execute call tx hash:", executeCallTxHash);

    // check callExecuted event
    // console.log("\n# waiting for callExecuted event on evm chain...");
    // const callExecutedEvent = await checkCallExecutedEventEvm(
    //   executeCallTxHash
    // );
    // vote no from icon
    // const voteNoFromIconResult = await voteNoFromIcon(contracts.primary);
    // console.log("\n# vote no from icon result:", voteNoFromIconResult);
  } catch (e) {
    console.log("error running tests", e);
  }
}

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
      await tests(contracts);
    }
  } catch (e) {
    console.log("error running main", e);
  }
}

main();
