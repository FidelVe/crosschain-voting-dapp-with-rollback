const IconService = require("icon-sdk-js");
const fs = require("fs");
const config = require("./config");

const {
  IconBuilder,
  IconConverter,
  SignedTransaction,
  HttpProvider,
  IconWallet
} = IconService.default;

const { PK, NID, RPC_URL } = config;

const HTTP_PROVIDER = new HttpProvider(RPC_URL);
const ICON_SERVICE = new IconService.default(HTTP_PROVIDER);
const WALLET = IconWallet.loadPrivateKey(PK);

function getContractByteCode() {
  try {
    return fs.readFileSync("./build/libs/contract.jar").toString("hex");
  } catch (e) {
    console.log(e);
    throw new Error("Error reading contract info");
  }
}

function deployContract(params) {
  const content = getContractByteCode();
  const payload = new IconBuilder.DeplyTransactionBuilder()
    .contentType("application/java")
    .content(`0x${content}`)
    .params(params)
    .from(WALLET.getAddress())
    .to("cx0000000000000000000000000000000000000000")
    .nid(NID)
    .version(3)
    .timestamp(new Date().getTime() * 1000)
    .stepLimit(IconConverter.toBigNumber(250000000))
    .build();

  const signedTx = new SignedTransaction(payload, WALLET);
  return ICON_SERVICE.sendTransaction(signedTx).execute();
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
      sleep(1000);
    }
  }
}

const lib = {
  deployContract,
  getTxResult
};

module.exports = lib;
