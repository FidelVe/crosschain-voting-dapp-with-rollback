require("dotenv").config();
const { PK } = process.env;

// modify this to change the network. Options are localhost, berlin, custom
const USE_NETWORK = "berlin";

const config = {
  rpc: {
    localhost: "http://localhost:9080/api/v3",
    berlin: "https://berlin.net.solidwallet.io/api/v3/icon_dex",
    custom: "https://server02.espanicon.team/api/v3"
  },
  contract: {
    chain: "cx0000000000000000000000000000000000000000",
    governance: "cx0000000000000000000000000000000000000001",
    xcall: "cxf4958b242a264fc11d7d8d95f79035e35b21c1bb"
  },
  nid: {
    localhost: 3,
    berlin: 7,
    custom: 3
  }
};

module.exports = {
  ...config,
  PK: PK,
  network: USE_NETWORK,
  RPC_URL: config.rpc[USE_NETWORK],
  NID: config.nid[USE_NETWORK],
  jarPath:
    "./contract/crosschain-voting-dapp/build/libs/crosschain-voting-dapp-optimized.jar"
};
