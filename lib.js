const IconService = require("icon-sdk-js");
const fs = require("fs");
const config = require("./config");
const { Web3 } = require("web3");

const {
  IconBuilder,
  IconConverter,
  SignedTransaction,
  HttpProvider,
  IconWallet
} = IconService.default;

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
  // NETWORK_LABEL_PRIMARY,
  NETWORK_LABEL_SECONDARY
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

async function deployEvm() {
  try {
    console.log("\n # Deploying contract on EVM chain...");
    const { abi, bytecode } = getEvmContract();
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

    console.log(
      "\n# Deployed contract address:",
      deployedContract.options.address
    );
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
const lib = {
  deployContract,
  getTxResult,
  config,
  getScoreApi,
  getIconDappDeploymentsParams,
  deployIcon,
  deployEvm
};

module.exports = lib;
