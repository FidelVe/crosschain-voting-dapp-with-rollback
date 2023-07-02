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
    icon: {
      chain: "cx0000000000000000000000000000000000000000",
      governance: "cx0000000000000000000000000000000000000001",
      xcall: "cxf4958b242a264fc11d7d8d95f79035e35b21c1bb"
    },
    sepolia: {
      dapp: "0x52D0A13ABD0B949FF840de7F953545BBB9259A9c",
      xcall: "0x232dd167F4141d4313C29b5ea264aa98f9c339d4"
    }
  },
  nid: {
    localhost: 3,
    berlin: 7,
    custom: 3
  },
  network: {
    icon: {
      label: "0x7.icon"
    },
    sepolia: {
      label: "0xaa36a7.eth2"
    }
  }
};

module.exports = {
  ...config,
  PK: PK,
  USE_NETWORK: USE_NETWORK,
  RPC_URL: config.rpc[USE_NETWORK],
  NID: config.nid[USE_NETWORK],
  jarPath:
    "./contract/crosschain-voting-dapp/build/libs/crosschain-voting-dapp-optimized.jar"
};
