const IconService = require("icon-sdk-js");
const fs = require("fs");
const config = require("./config");
const Web3 = require("web3");

const {
  IconBuilder,
  IconConverter,
  SignedTransaction,
  HttpProvider,
  IconWallet
} = IconService.default;

const {
  contract,
  network,
  PK_BERLIN,
  PK_SEPOLIA,
  NID,
  RPC_URL,
  jarPath,
  solPath
} = config;

const HTTP_PROVIDER = new HttpProvider(RPC_URL);
const ICON_SERVICE = new IconService.default(HTTP_PROVIDER);
const WALLET = IconWallet.loadPrivateKey(PK_BERLIN);

function getIconContractByteCode() {
  try {
    return fs.readFileSync(jarPath).toString("hex");
  } catch (e) {
    console.log(e);
    throw new Error("Error reading contract info");
  }
}

function getEvmContract() {
  try {
    const result = {
      abi: null,
      bytecode: null
    };
    const contract = JSON.parse(fs.readFileSync(solPath));
    result.abi = contract.abi;
    result.bytecode = contract.bytecode;
    return result;
  } catch (e) {
    console.log(e);
    throw new Error("Error reading EVM contract info");
  }
}

function getDappDeploymentsParams() {
  const result = {
    _sourceXCallContract: config.contract.icon.xcall,
    _destinationBtpAddress: getBtpAddress(
      network.sepolia.label,
      contract.sepolia.dapp
    )
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
      .from(WALLET.getAddress())
      .to(contract.icon.chain)
      .nid(NID)
      .version(3)
      .timestamp(new Date().getTime() * 1000)
      .stepLimit(IconConverter.toBigNumber(2500000000))
      .build();

    const signedTx = new SignedTransaction(payload, WALLET);
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

const lib = {
  deployContract,
  getTxResult,
  config,
  getScoreApi,
  getDappDeploymentsParams
};

module.exports = lib;
