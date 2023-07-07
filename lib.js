const IconService = require("icon-sdk-js");
const fs = require("fs");
const config = require("./config");
const { Web3 } = require("web3");
const { ethers } = require("ethers");
const { BigNumber } = ethers;

const {
  IconBuilder,
  IconConverter,
  SignedTransaction,
  HttpProvider,
  IconWallet
} = IconService.default;

const { CallTransactionBuilder, CallBuilder } = IconBuilder;
const {
  contract,
  // network,
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
  xcallAbiPath
} = config;

const HTTP_PROVIDER = new HttpProvider(ICON_RPC_URL);
const ICON_SERVICE = new IconService.default(HTTP_PROVIDER);
const ICON_WALLET = IconWallet.loadPrivateKey(PK_BERLIN);

const EVM_SERVICE = new Web3(EVM_RPC_URL);
// const EVM_SERVICE = new Web3(new Web3.providers.HttpProvider(EVM_RPC_URL));
const EVM_WALLET = EVM_SERVICE.eth.accounts.privateKeyToAccount(
  PK_SEPOLIA,
  true
);
EVM_SERVICE.eth.accounts.wallet.add(EVM_WALLET);

function getIconContractByteCode() {
  try {
    return fs.readFileSync(jarPath).toString("hex");
  } catch (e) {
    console.log(e);
    throw new Error("Error reading contract info");
  }
}

function isDeployed() {
  try {
    if (!fs.existsSync(deploymentsPath)) {
      return false;
    }
    return true;
  } catch (e) {
    console.log(e);
    throw new Error("Error checking deployments");
  }
}

function saveDeployments(deployments) {
  try {
    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments));
  } catch (e) {
    console.log(e);
    throw new Error("Error saving deployments");
  }
}

function getDeployments() {
  try {
    return JSON.parse(fs.readFileSync(deploymentsPath));
  } catch (e) {
    console.log(e);
    throw new Error("Error reading deployments");
  }
}

function getEvmContract(abiPath) {
  try {
    const result = {
      abi: null,
      bytecode: null
    };
    const contract = JSON.parse(fs.readFileSync(abiPath));
    result.abi = contract.abi;
    result.bytecode = contract.bytecode;
    return result;
  } catch (e) {
    console.log(e);
    throw new Error("Error reading EVM contract info");
  }
}

function getDappContract() {
  return getEvmContract(solPath);
}

function getXcallContract() {
  return getEvmContract(xcallAbiPath);
}

function getIconDappDeploymentsParams(label, dappContract) {
  const result = {
    _sourceXCallContract: XCALL_PRIMARY,
    _destinationBtpAddress: getBtpAddress(label, dappContract)
  };
  return result;
}

function getBtpAddress(label, address) {
  return `btp://${label}/${address}`;
}

async function deployContract(params) {
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

async function getScoreApi(contract) {
  try {
    return await ICON_SERVICE.getScoreApi(contract).execute();
  } catch (e) {
    console.log("error getting abi", e);
    throw new Error("Error getting abi");
  }
}

async function filterEventICON(eventlogs, sig, address) {
  return eventlogs.filter(event => {
    return (
      event.indexed &&
      event.indexed[0] === sig &&
      (!address || address === event.scoreAddress)
    );
  });
}

async function filterCallMessageSentEvent(eventlogs) {
  return filterEventICON(
    eventlogs,
    "CallMessageSent(Address,str,int,int)",
    XCALL_PRIMARY
  );
}

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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
function filterCallExecutedEventEvm(id) {
  const xcallContract = getXcallContractEVM();
  const callMessageFilters = xcallContract.filters.CallExecuted(id);
  console.log("xcall contract filters");
  console.log(callMessageFilters);
  return callMessageFilters;
}

function filterCallMessageEventEvm(iconDappAddress, evmDappAddress, sn) {
  const btpAddressSource = getBtpAddress(
    NETWORK_LABEL_PRIMARY,
    iconDappAddress
  );
  const xcallContract = getXcallContractEVM();
  const callMessageFilters = xcallContract.filters.CallMessage(
    btpAddressSource,
    evmDappAddress,
    sn
  );
  console.log("xcall contract filters");
  console.log(callMessageFilters);
  console.log(btpAddressSource);
  console.log(evmDappAddress);
  return callMessageFilters;
}

function getXcallContractEVM() {
  try {
    const { abi } = getXcallContract();
    return getContractObjectEVM(abi, XCALL_SECONDARY);
  } catch (e) {
    console.log(e);
    throw new Error("Error getting Xcall contract");
  }
}

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

async function waitEventEVM(filterCM) {
  const contract = getXcallContractEVM();
  let height = await contract.provider.getBlockNumber();
  let next = height + 1;
  console.log("block height", height);
  while (true) {
    if (height == next) {
      await sleep(1000);
      next = (await contract.provider.getBlockNumber()) + 1;
      continue;
    }
    for (; height < next; height++) {
      console.log(`waitEventEvmChain: ${height} -> ${next}`);
      const events = await contract.queryFilter(filterCM, height);
      if (events.length > 0) {
        return events;
      }
    }
  }
}

async function executeCallEvm(id, data) {
  try {
    const contract = getXcallContractEVM();
    return await sendSignedTxEVM(contract, "executeCall", id, data);
  } catch (e) {
    console.log(e);
    throw new Error("Error executing call");
  }
}

async function sendSignedTxEVM(contract, method, ...args) {
  // const signer = new ethers.wallet(PK_SEPOLIA, EVM_RPC_URL);
  // const gas = await contract.estimateGas[method](...args);
  // conse useGas = gas.toNumber() + 100000000;
  const txParams = { gasLimit: 15000000 };

  const tx = await contract[method](...args, txParams);
  const receipt = await tx.wait(1);
  return receipt;
}

async function callDappContractMethod(method, contract, useRollback = false) {
  try {
    const fee = await getFeeFromIcon(useRollback);

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
async function voteYesFromIcon(contract, useRollback = false) {
  try {
    return await callDappContractMethod("voteYes", contract, useRollback);
  } catch (e) {
    console.log(e);
    throw new Error("Error voting yes");
  }
}

async function voteNoFromIcon(contract, useRollback = false) {
  try {
    return await callDappContractMethod("voteNo", contract, useRollback);
  } catch (e) {
    console.log(e);
    throw new Error("Error voting no");
  }
}

async function getFeeFromIcon(useRollback = false) {
  try {
    const params = {
      _net: NETWORK_LABEL_SECONDARY,
      _rollback: useRollback ? "0x1" : "0x0"
    };

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

async function deployEvm() {
  try {
    console.log("\n # Deploying contract on EVM chain...");
    const { abi, bytecode } = getDappContract();
    const contract = new EVM_SERVICE.eth.Contract(abi);
    // contract.options.data = bytecode;
    const deployTx = contract.deploy({
      data: bytecode,
      arguments: [XCALL_SECONDARY]
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

    // console.log(
    //   "\n# Deployed contract address:",
    //   deployedContract.options.address
    // );
    return deployedContract.options.address;
  } catch (e) {
    console.log(e);
    throw new Error("Error deploying contract on EVM chain");
  }
}

async function deployIcon(evmDappContract) {
  try {
    console.log("\n # Deploying contract on ICON chain...");
    const params = getIconDappDeploymentsParams(
      NETWORK_LABEL_SECONDARY,
      evmDappContract
    );
    console.log("\n# Params for contract deployment on ICON:", params);

    const receipt = await deployContract(params);
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

function strToHex(str) {
  var hex = "";
  for (var i = 0; i < str.length; i++) {
    hex += "" + str.charCodeAt(i).toString(16);
  }
  return "0x" + hex;
}

function strToHexPadded(str) {
  var hex = "";
  for (var i = 0; i < str.length; i++) {
    hex +=
      "" +
      str
        .charCodeAt(i)
        .toString(16)
        .padStart(2, "0");
  }
  return "0x" + hex;
}

const lib = {
  deployContract,
  getTxResult,
  config,
  getScoreApi,
  getIconDappDeploymentsParams,
  deployIcon,
  deployEvm,
  isDeployed,
  saveDeployments,
  getDeployments,
  strToHex,
  strToHexPadded,
  voteYesFromIcon,
  voteNoFromIcon,
  filterCallMessageSentEvent,
  parseCallMessageSentEvent,
  filterCallMessageEventEvm,
  waitEventEVM,
  executeCallEvm,
  filterCallExecutedEventEvm
};

module.exports = lib;
