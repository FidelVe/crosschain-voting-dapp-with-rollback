const IconService = require("icon-sdk-js");
const utils = require("./utils");
const { Web3 } = require("web3");
const { ethers } = require("ethers");
const { BigNumber } = ethers;

const {
  // config values
  contract,
  PK_BERLIN,
  PK_SEPOLIA,
  NID,
  ICON_RPC_URL,
  EVM_RPC_URL,
  jarPath,
  solPath,
  XCALL_PRIMARY,
  XCALL_SECONDARY,
  NETWORK_LABEL_PRIMARY,
  NETWORK_LABEL_SECONDARY,
  deploymentsPath,
  xcallAbiPath,
  tracker,
  customRequest,
  // methods
  getIconContractByteCode,
  isDeployed,
  saveDeployments,
  getDeployments,
  getEvmContract,
  getDappContract,
  getXcallContract,
  getIconDappDeploymentsParams,
  getBtpAddress,
  filterEventICON,
  filterCallMessageSentEvent,
  sleep,
  strToHex,
  strToHexPadded,
  fileExists,
  parseEventResponseFromTracker
} = utils;

const {
  IconBuilder,
  IconConverter,
  SignedTransaction,
  HttpProvider,
  IconWallet
} = IconService.default;

// validate configs
validateConfig();

const { CallTransactionBuilder, CallBuilder } = IconBuilder;

const HTTP_PROVIDER = new HttpProvider(ICON_RPC_URL);
const ICON_SERVICE = new IconService.default(HTTP_PROVIDER);
const ICON_WALLET = IconWallet.loadPrivateKey(PK_BERLIN);

const EVM_SERVICE = new Web3(EVM_RPC_URL);
const EVM_WALLET = EVM_SERVICE.eth.accounts.privateKeyToAccount(
  PK_SEPOLIA,
  true
);
EVM_SERVICE.eth.accounts.wallet.add(EVM_WALLET);

/*
 * Validate the config values
 * @throws {Error} - if there is an error validating the config values
 */
function validateConfig() {
  try {
    if (PK_BERLIN == null) {
      throw new Error("PK_BERLIN is not set");
    } else if (
      PK_SEPOLIA == null ||
      (typeof PK_SEPOLIA !== "string" && PK_SEPOLIA.slice(0, 2) !== "0x")
    ) {
      throw new Error("PK_SEPOLIA is not set");
    }

    if (!fileExists(jarPath)) {
      throw new Error("compile java contract not found");
    }

    if (!fileExists(solPath)) {
      throw new Error("compile solidity contract not found");
    }
  } catch (e) {
    console.log(e.message);
    throw new Error("Error validating config");
  }
}

async function fetchEventsFromTracker() {
  try {
    const response = await customRequest(
      `${tracker.logs}${XCALL_PRIMARY}`,
      false,
      tracker.hostname
    );
    return response;
  } catch (e) {
    console.log("error fetching events from tracker", e);
    throw new Error("Error fetching events from tracker");
  }
}

/*
 * deployIconContract - deploys the contract on ICON
 * @param {object} params - the params for the Icon contract
 * @returns {object} - the result of the transaction
 * @throws {Error} - if there is an error deploying the contract
 */
async function deployIconContract(params) {
  try {
    const content = getIconContractByteCode();
    const payload = new IconBuilder.DeployTransactionBuilder()
      .contentType("application/java")
      .content(`0x${content}`)
      .params(params)
      .from(ICON_WALLET.getAddress())
      .to(contract.icon.chain)
      .nid(NID)
      .version(3)
      .timestamp(new Date().getTime() * 1000)
      .stepLimit(IconConverter.toBigNumber(2500000000))
      .build();

    const signedTx = new SignedTransaction(payload, ICON_WALLET);
    return await ICON_SERVICE.sendTransaction(signedTx).execute();
  } catch (e) {
    console.log("error deploying contract", e);
    throw new Error("Error deploying contract");
  }
}

/*
 * getScoreApi - returns the abi of the contract
 * @param {string} contract - the address of the contract
 * @returns {object} - the abi of the contract
 * @throws {Error} - if there is an error getting the abi
 */
async function getScoreApi(contract) {
  try {
    return await ICON_SERVICE.getScoreApi(contract).execute();
  } catch (e) {
    console.log("error getting abi", e);
    throw new Error("Error getting abi");
  }
}

/*
 * parseCallMessageSentEvent - parses the CallMessageSent event logs
 * @param {object} event - the event logs
 * @returns {object} - the parsed event logs
 * @throws {Error} - if there is an error parsing the event logs
 */
async function parseCallMessageSentEvent(event) {
  const indexed = event[0].indexed || [];
  const data = event[0].data || [];
  return {
    _from: indexed[1],
    _to: indexed[2],
    _sn: BigNumber.from(indexed[3]),
    _nsn: BigNumber.from(data[0])
  };
}

/*
 * getTxResult - gets the transaction result
 * @param {string} txHash - the transaction hash
 * @returns {object} - the transaction result
 * @throws {Error} - if there is an error getting the transaction result
 */
async function getTxResult(txHash) {
  const maxLoops = 10;
  let loop = 0;
  while (loop < maxLoops) {
    try {
      return await ICON_SERVICE.getTransactionResult(txHash).execute();
    } catch (e) {
      console.log(`txResult (pass ${loop}): ${e}`);
      loop++;
      await sleep(1000);
    }
  }
}

/*
 * callDappContractMethod - calls the dapp contract method
 * @param {string} method - the method to call
 * @param {string} contract - the address of the contract
 * @param {boolean} useRollback - whether to use rollback
 * @returns {object} - the transaction receipt
 * @throws {Error} - if there is an error calling the dapp contract method
 */
async function callDappContractMethod(method, contract, useRollback = true) {
  try {
    const fee = await getFeeFromIcon(useRollback);
    // console.log("# fee", fee);

    const txObj = new CallTransactionBuilder()
      .from(ICON_WALLET.getAddress())
      .to(contract)
      .stepLimit(IconConverter.toBigNumber(20000000))
      .nid(IconConverter.toBigNumber(NID))
      .nonce(IconConverter.toBigNumber(1))
      .version(IconConverter.toBigNumber(3))
      .timestamp(new Date().getTime() * 1000)
      .method(method)
      .value(fee)
      .build();

    const signedTx = new SignedTransaction(txObj, ICON_WALLET);
    return await ICON_SERVICE.sendTransaction(signedTx).execute();
  } catch (e) {
    console.log(e);
    throw new Error("Error calling contract method");
  }
}

/*
 * voteYesFromIcon - calls the voteYes method of the dapp contract
 * @param {string} contract - the address of the contract
 * @param {boolean} useRollback - whether to use rollback
 * @returns {object} - the transaction receipt
 * @throws {Error} - if there is an error voting yes
 */
async function voteYesFromIcon(contract, useRollback = true) {
  try {
    return await callDappContractMethod("voteYes", contract, useRollback);
  } catch (e) {
    console.log(e);
    throw new Error("Error voting yes");
  }
}

/*
 * voteNoFromIcon - calls the voteNo method of the dapp contract
 * @param {string} contract - the address of the contract
 * @param {boolean} useRollback - whether to use rollback
 * @returns {object} - the transaction receipt
 * @throws {Error} - if there is an error voting no
 */
async function voteNoFromIcon(contract, useRollback = true) {
  try {
    return await callDappContractMethod("voteNo", contract, useRollback);
  } catch (e) {
    console.log(e);
    throw new Error("Error voting no");
  }
}

/*
 * getVotesFromICON - calls the getVotes method of the dapp contract
 * @param {string} contract - the address of the contract
 * @returns {object} - the transaction receipt
 * @throws {Error} - if there is an error getting the votes
 */
async function getVotesFromICON(contract) {
  try {
    const txObj = new CallBuilder()
      .to(contract)
      .method("getVotes")
      .build();

    return await ICON_SERVICE.call(txObj).execute();
  } catch (e) {
    console.log("error getting votes", e);
    throw new Error("Error getting votes");
  }
}

/*
 * getFeeFromIcon - calls the getFee method of the xcall contract
 * @param {boolean} useRollback - whether to use rollback
 * @returns {object} - the transaction receipt
 * @throws {Error} - if there is an error getting the fee
 */
async function getFeeFromIcon(useRollback = true) {
  try {
    const params = {
      _net: NETWORK_LABEL_SECONDARY,
      _rollback: useRollback ? "0x1" : "0x0"
    };
    // console.log("# params", params);

    const txObj = new CallBuilder()
      .to(XCALL_PRIMARY)
      .method("getFee")
      .params(params)
      .build();

    return await ICON_SERVICE.call(txObj).execute();
  } catch (e) {
    console.log("error getting fee", e);
    throw new Error("Error getting fee");
  }
}

/*
 * deployIcon - deploys the dapp contract on the ICON chain
 * @param {string} evmDappContract - the address of the EVM dapp contract
 * @returns {string} - the address of the deployed contract
 * @throws {Error} - if there is an error deploying the contract
 */
async function deployIcon(evmDappContract) {
  try {
    console.log("\n # Deploying contract on ICON chain...");
    const params = getIconDappDeploymentsParams(
      NETWORK_LABEL_SECONDARY,
      evmDappContract
    );
    console.log("\n# Params for contract deployment on ICON:", params);

    const receipt = await deployIconContract(params);
    console.log("\n# Receipt for contract deployment on ICON:", receipt);

    const txResult = await getTxResult(receipt);
    console.log("\n# TxResult for contract deployment on ICON:", txResult);

    const scoreAddress = txResult["scoreAddress"];
    const scoreApi = await getScoreApi(scoreAddress);
    const abi = scoreApi.getList();
    console.log(
      "\n# ScoreApi for contract deployment on ICON:",
      JSON.stringify(abi)
    );
    return scoreAddress;
  } catch (e) {
    console.log(e);
    throw new Error("Error deploying contract ICON chain");
  }
}

/*
 * getTransactionsFromBlockICON - gets the transactions from a block
 * @param {object} block - the block
 * @returns {array} - the transactions
 * @throws {Error} - if there is an error getting the transactions
 */
async function getTransactionsFromBlockICON(block) {
  const transactions = [];
  try {
    for (const tx of block.confirmedTransactionList) {
      const txResult = await getTxResult(tx.txHash);
      transactions.push(txResult);
      if (txResult === null) {
        throw new Error("txResult is null");
      }
    }
  } catch (e) {
    console.log("error running getTransactionsFromBlock", e);
    throw new Error("Error running getTransactionsFromBlock");
  }
  return transactions;
}

/*
 * getBlockICON - gets a block
 * @param {string} hashOrNumber - the block hash or number
 * @returns {object} - the block
 * @throws {Error} - if there is an error getting the block
 */
async function getBlockICON(hashOrNumber = null) {
  try {
    if (hashOrNumber == null || hashOrNumber === "latest") {
      return await ICON_SERVICE.getLastBlock().execute();
    } else if (typeof hashOrNumber === "string") {
      const isHash =
        !Number.isNaN(Number(hashOrNumber)) && hashOrNumber.slice(0, 2) === "0x"
          ? true
          : false;
      if (isHash) {
        return await ICON_SERVICE.getBlockByHash(hashOrNumber).execute();
      }
    } else if (typeof hashOrNumber === "number") {
      return await ICON_SERVICE.getBlockByHeight(hashOrNumber).execute();
    }
    // raise error if not hash or number
    throw new Error("invalid type for param hashOrNumber");
  } catch (e) {
    console.log("error running getBlock", e);
    throw new Error("Error running getBlock");
  }
}

/*
 * waitResponseMessageEventICON - waits for the ResponseMessage event
 * @param {string} contractAddress - the address of the contract
 * @param {number} id - the id of the event
 * @param {number} blocksToWait - the number of blocks to wait
 * @returns {object} - the event
 * @throws {Error} - if there is an error waiting for the event
 */
async function waitResponseMessageEventICON(id) {
  const sig = "ResponseMessage(int,int,str)";
  const parseId = id.toHexString();
  return await waitEventFromTrackerICON(sig, XCALL_PRIMARY, parseId);
}

/*
 * waitRollbackExecutedEventICON - waits for the RollbackExecuted event
 * @param {string} contractAddress - the address of the contract
 * @param {number} id - the id of the event
 * @param {number} blocksToWait - the number of blocks to wait
 * @returns {object} - the event
 * @throws {Error} - if there is an error waiting for the event
 */
async function waitRollbackExecutedEventICON(id) {
  const sig = "RollbackExecuted(int,int,str)";
  const parseId = id.toHexString();
  return await waitEventFromTrackerICON(sig, XCALL_PRIMARY, parseId);
}

async function waitRollbackMessageEventICON(id) {
  const sig = "RollbackMessage(int)";
  const parseId = id.toHexString();
  return await waitEventFromTrackerICON(sig, XCALL_PRIMARY, parseId);
}

async function executeRollbackICON(id) {
  try {
    const params = {
      _sn: id
    };
    const txObj = new CallTransactionBuilder()
      .from(ICON_WALLET.getAddress())
      .to(XCALL_PRIMARY)
      .params(params)
      .stepLimit(IconConverter.toBigNumber(20000000))
      .nid(IconConverter.toBigNumber(NID))
      .nonce(IconConverter.toBigNumber(1))
      .version(IconConverter.toBigNumber(3))
      .timestamp(new Date().getTime() * 1000)
      .method("executeRollback")
      .build();

    const signedTx = new SignedTransaction(txObj, ICON_WALLET);
    return await ICON_SERVICE.sendTransaction(signedTx).execute();
  } catch (e) {
    console.log(e);
    throw new Error(
      "Error calling executeRollback method on xCall contract on source chain"
    );
  }
}

/*
 * waitEventFromTrackerICON - waits for an event from the tracker
 * @param {string} sig - the signature of the event
 * @param {string} address - the address of the contract
 * @param {number} id - the id of the event
 * @param {number} maxMinutesToWait - the max number of minutes to wait
 * @returns {object} - the event
 * @throws {Error} - if there is an error waiting for the event
 */
async function waitEventFromTrackerICON(
  sig,
  address,
  id,
  maxMinutesToWait = 40
) {
  try {
    console.log(`## Waiting for event ${sig} on ${address} with id ${id}`);

    let minutesWaited = 0;
    let highestIdFound = 0;
    let minsToWaitOnEachLoop = 1;

    console.log(
      `# If destination chain is Sepolia, the wait period is around 20 min for the event to be raised because of the block finality.`
    );
    while (minutesWaited < maxMinutesToWait) {
      let events = await fetchEventsFromTracker();
      const parsedEvent = parseEventResponseFromTracker(events);
      const filterEvents = filterEventICON(parsedEvent, sig, address);

      if (filterEvents.length > 0) {
        console.log(`## Found event ${sig}`);
        for (const event of filterEvents) {
          const idNumber = parseInt(id);
          const eventIdNumber = parseInt(event.indexed[1]);
          if (eventIdNumber == idNumber) {
            return event;
          } else {
            if (eventIdNumber >= highestIdFound) {
              highestIdFound = eventIdNumber;
              console.log(
                `## Event id does not match. Found Id: ${eventIdNumber} (${
                  event.indexed[1]
                }), Looking for Id: ${idNumber} (${id})`
              );
            } else {
              continue;
            }
          }
        }
        console.log(
          `#  Event not found, will continue to wait for ${minsToWaitOnEachLoop} minutes`
        );
        console.log(`# waiting (waited for ${minutesWaited} minutes so far)..`);
        console.log("# press ctrl + c to exit\n");
        minutesWaited += minsToWaitOnEachLoop;
        await sleep(60000 * minsToWaitOnEachLoop);
      }
    }

    console.log(`## Waited for ${maxMinutesToWait} minutes`);
    throw new Error(`Event with signature "${sig}" never raised`);
  } catch (e) {
    console.log("error waiting for event", e);
    throw new Error("Error waiting for event");
  }
}

async function waitEventICON(sig, address, id, maxMinutesToWait = 25) {
  try {
    console.log(`## Waiting for event ${sig} on ${address} with id ${id}`);
    const latestBlock = await getBlockICON("latest");
    let blockNumber = latestBlock.height - 2;
    let minutesWaited = 0;

    while (minutesWaited < maxMinutesToWait) {
      const latestBlock = await getBlockICON("latest");
      if (blockNumber > latestBlock.height) {
        minutesWaited += 1;
        await sleep(1000);
        continue;
      }
      const parsedBlockNumber = blockNumber.toString();
      console.log(`## Fetching block ${parsedBlockNumber} for event`);
      const block = await getBlockICON(blockNumber);
      const txsInBlock = await getTransactionsFromBlockICON(block);
      for (const tx of txsInBlock) {
        const filteredEvents = filterEventICON(tx.eventLogs, sig, address);
        if (filteredEvents.length > 0) {
          console.log(`## Found event ${sig} on block ${parsedBlockNumber}`);
          for (const event of filteredEvents) {
            const idNumber = parseInt(id);
            const eventIdNumber = parseInt(event.indexed[1]);
            if (eventIdNumber == idNumber) {
              return event;
            } else {
              if (eventIdNumber > idNumber) {
                // if the event id is greater than the expected id, then the event was raised in a previous block that was not checked
                throw new Error("Event id is greater than expected");
              }
              console.log(
                `## Event id does not match. Found Id: ${eventIdNumber}, Looking for Id: ${idNumber}`
              );
              console.log(
                "# If destination chain is Sepolia, the wait period is around 20 min for the event to be raised because of the block finality, script will wait for 5 more minutes and will continue to check for event after that period"
              );
              console.log("# press ctrl + c to exit");
              console.log("# waiting..");
              minutesWaited += 5;
              await sleep(300000);
            }
          }
        }
      }
      blockNumber++;
    }

    throw new Error(`Event with signature "${sig}" never raised`);
  } catch (e) {
    console.log("error waiting for event", e);
  }
  return null;
}

/*
 * filterEventEvm - filters the event logs
 * @param {string} id - the id of the event
 * @returns {object} - the filtered event logs
 * @throws {Error} - if there is an error filtering the event logs
 */
function filterEventEvm(event, ...params) {
  try {
    const xcallContract = getXcallContractEVM();
    const filters = xcallContract.filters[event](...params);
    return filters;
  } catch (e) {
    console.log("error filtering event", e);
    throw new Error("Error filtering event");
  }
}

/*
 * filterRollbackMessageEventEvm - filters the RollbackMessage event logs
 * @param {string} id - the id of the event
 * @returns {object} - the filtered event logs
 * @throws {Error} - if there is an error filtering the event logs
 */
function filterRollbackMessageEventEvm(id) {
  return filterEventEvm("RollbackMessage", id);
}

/*
 * filterResponseMessageEventEvm - filters the ResponseMessage event logs
 * @param {string} id - the id of the event
 * @returns {object} - the filtered event logs
 * @throws {Error} - if there is an error filtering the event logs
 */
function filterResponseMessageEventEvm(id) {
  return filterEventEvm("ResponseMessage", id);
}

/*
 * filterCallExecutedEventEvm - filters the CallExecuted event logs
 * @param {string} id - the id of the event
 * @returns {object} - the filtered event logs
 * @throws {Error} - if there is an error filtering the event logs
 */
function filterCallExecutedEventEvm(id) {
  return filterEventEvm("CallExecuted", id);
}

/*
 * filterCallMessageEventEvm - filters the CallMessage event logs
 * @param {string} iconDappAddress - the address of the ICON dapp
 * @param {string} evmDappAddress - the address of the EVM dapp
 * @param {string} sn - the serial number cross chain transaction
 * @returns {object} - the filtered event logs
 * @throws {Error} - if there is an error filtering the event logs
 */
function filterCallMessageEventEvm(iconDappAddress, evmDappAddress, sn) {
  const btpAddressSource = getBtpAddress(
    NETWORK_LABEL_PRIMARY,
    iconDappAddress
  );
  return filterEventEvm("CallMessage", btpAddressSource, evmDappAddress, sn);
}

/*
 * getVotesFromEVM - gets the votes from the EVM chain
 * @param {string} contractAddress - the address of the contract
 * @returns {object} - the votes
 * @throws {Error} - if there is an error getting the votes
 */
async function getVotesFromEVM(contractAddress) {
  const contractObject = getDappContractObject(contractAddress);
  return await contractObject.getVotes();
}

/*
 * getVotesCapFromEVM - gets the votes cap from the EVM chain
 * @param {string} contractAddress - the address of the contract
 * @returns {object} - the votes cap
 * @throws {Error} - if there is an error getting the votes cap
 */
async function getVotesCapFromEVM(contractAddress) {
  const contractObject = getDappContractObject(contractAddress);
  return await contractObject.getVotesCap();
}

/*
 * getDappContractObject - gets the dapp contract object
 * @param {string} contractAddress - the address of the contract
 * @returns {object} - the dapp contract object
 * @throws {Error} - if there is an error getting the dapp contract object
 */
function getDappContractObject(contractAddress) {
  try {
    const { abi } = getDappContract();
    return getContractObjectEVM(abi, contractAddress);
  } catch (e) {
    console.log(e);
    throw new Error("Error getting dapp contract");
  }
}

/*
 * getXcallContractEVM - gets the xcall contract object
 * @returns {object} - the xcall contract object
 * @throws {Error} - if there is an error getting the xcall contract object
 */
function getXcallContractEVM() {
  try {
    const { abi } = getXcallContract();
    return getContractObjectEVM(abi, XCALL_SECONDARY);
  } catch (e) {
    console.log(e);
    throw new Error("Error getting Xcall contract");
  }
}

/*
 * getContractObjectEVM - gets the contract object
 * @param {object} abi - the abi of the contract
 * @param {string} address - the address of the contract
 * @returns {object} - the contract object
 * @throws {Error} - if there is an error getting the contract object
 */
function getContractObjectEVM(abi, address) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(EVM_RPC_URL);
    const signer = new ethers.Wallet(PK_SEPOLIA, provider);
    const contractObject = new ethers.Contract(address, abi, signer);
    return contractObject;
  } catch (e) {
    console.log(e);
    throw new Error("Error getting contract object");
  }
}

/*
 * waitEventEVM - waits for the event to be emitted
 * @param {object} filterCM - the filter for the event
 * @returns {object} - the event logs
 * @throws {Error} - if there is an error waiting for the event
 */
async function waitEventEVM(filterCM, filterCM2 = null) {
  const contract = getXcallContractEVM();
  let height = await contract.provider.getBlockNumber();
  let next = height + 1;
  console.log("block height", height);
  const maxSeconds = 30 * 60;
  let secondsWaited = 0;
  if (filterCM2 != null) {
    await fetchEventEVMInBlockRange(filterCM2, -100, contract);
  }
  while (secondsWaited < maxSeconds) {
    try {
      if (height == next) {
        await sleep(1000);
        secondsWaited++;
        next = (await contract.provider.getBlockNumber()) + 1;
        continue;
      }
      for (; height < next; height++) {
        const parsedMinutes = secondsWaited / 60;
        console.log(
          `waitEventEvmChain: ${height} -> ${next}. (time waited ${parsedMinutes.toFixed(
            2
          )} minutes)`
        );
        const events = await contract.queryFilter(filterCM, height);
        if (events.length > 0) {
          return events;
        }
      }
    } catch (e) {
      console.log("waitEventEvmChain error", e);
    }
  }

  throw new Error("Error waiting for event");
}

async function fetchEventEVMInBlockRange(filter, blocks = -100, contract) {
  try {
    const events = await contract.queryFilter(filter, blocks, "latest");
    if (events.length > 0) {
      console.log("fetchEventEVMInBlockRange", events[0].topics);
      console.log("Latest event ID found", events[0].topics[3]);
    }
  } catch (e) {
    console.log("fetchEventEVMInBlockRange error", e);
  }
}
/*
 * executeCallEvm - calls the executeCall method of the xcall contract
 * @param {string} id - the id of the cross chain transaction
 * @param {string} data - the data of the cross chain transaction
 * @returns {object} - the transaction receipt
 * @throws {Error} - if there is an error executing the call
 */
async function executeCallEvm(id, data) {
  try {
    const contract = getXcallContractEVM();
    return await sendSignedTxEVM(contract, "executeCall", id, data);
  } catch (e) {
    console.log(e);
    throw new Error("Error executing call");
  }
}

/*
 * sendSignedTxEVM - sends the signed transaction
 * @param {object} contract - the contract object
 * @param {string} method - the method to call
 * @param {any[]} args - the arguments of the method
 * @returns {object} - the transaction receipt
 * @throws {Error} - if there is an error sending the signed transaction
 */
async function sendSignedTxEVM(contract, method, ...args) {
  const txParams = { gasLimit: 15000000 };

  const tx = await contract[method](...args, txParams);
  const receipt = await tx.wait(1);
  return receipt;
}

/*
 * deployEvm - deploys the dapp contract on the EVM chain
 * @returns {string} - the address of the deployed contract
 * @throws {Error} - if there is an error deploying the contract
 */
async function deployEvm() {
  try {
    console.log("\n # Deploying contract on EVM chain...");
    const { abi, bytecode } = getDappContract();
    const contract = new EVM_SERVICE.eth.Contract(abi);
    // contract.options.data = bytecode;
    const deployTx = contract.deploy({
      data: bytecode,
      arguments: [XCALL_SECONDARY, 10]
    });
    const deployedContract = await deployTx
      .send({
        from: EVM_WALLET.address,
        gas: await deployTx.estimateGas()
      })
      .once("transactionHash", txHash => {
        console.log("Mining deployment transaction...");
        console.log("txHash", txHash);
      });

    return deployedContract.options.address;
  } catch (e) {
    console.log(e);
    throw new Error("Error deploying contract on EVM chain");
  }
}

const lib = {
  // config values
  contract,
  PK_BERLIN,
  PK_SEPOLIA,
  NID,
  ICON_RPC_URL,
  EVM_RPC_URL,
  jarPath,
  solPath,
  XCALL_PRIMARY,
  XCALL_SECONDARY,
  NETWORK_LABEL_PRIMARY,
  NETWORK_LABEL_SECONDARY,
  deploymentsPath,
  xcallAbiPath,
  // utils
  getIconContractByteCode,
  isDeployed,
  saveDeployments,
  getDeployments,
  getEvmContract,
  getDappContract,
  getXcallContract,
  getIconDappDeploymentsParams,
  getBtpAddress,
  filterEventICON,
  filterCallMessageSentEvent,
  sleep,
  strToHex,
  strToHexPadded,
  // methods
  deployIconContract,
  getTxResult,
  getScoreApi,
  deployIcon,
  deployEvm,
  voteYesFromIcon,
  voteNoFromIcon,
  parseCallMessageSentEvent,
  filterCallMessageEventEvm,
  waitEventEVM,
  executeCallEvm,
  filterCallExecutedEventEvm,
  getVotesFromEVM,
  getVotesCapFromEVM,
  BigNumber,
  filterResponseMessageEventEvm,
  filterRollbackMessageEventEvm,
  waitResponseMessageEventICON,
  waitRollbackExecutedEventICON,
  waitRollbackMessageEventICON,
  fetchEventsFromTracker,
  waitEventFromTrackerICON,
  getVotesFromICON,
  executeRollbackICON,
  waitEventICON
};

module.exports = lib;
