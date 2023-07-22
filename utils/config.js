require("dotenv").config();
const { PK_BERLIN, PK_SEPOLIA } = process.env;

// modify this to change the network. Options are localhost, berlin, custom
const NETWORK_PRIMARY = "berlin";
const NETWORK_SECONDARY = "sepolia";

const config = {
  rpc: {
    localhost: "http://localhost:9080/api/v3",
    berlin: "https://berlin.net.solidwallet.io/api/v3/icon_dex",
    custom: "https://server02.espanicon.team/api/v3",
    sepolia: "https://sepolia.infura.io/v3/ffbf8ebe228f4758ae82e175640275e0"
  },
  tracker: {
    hostname: "tracker.berlin.icon.community",
    logs: "/api/v1/logs?address="
  },
  contract: {
    icon: {
      chain: "cx0000000000000000000000000000000000000000",
      governance: "cx0000000000000000000000000000000000000001"
    },
    berlin: {
      xcall: "cxf4958b242a264fc11d7d8d95f79035e35b21c1bb"
    },
    sepolia: {
      dapp: "0x597F73bfb3124B6145151E7a8A30b781C41FF2B0",
      xcall: "0x694C1f5Fb4b81e730428490a1cE3dE6e32428637"
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
    berlin: {
      label: "0x7.icon"
    },
    sepolia: {
      label: "0xaa36a7.eth2"
    }
  }
};

module.exports = {
  ...config,
  PK_BERLIN: PK_BERLIN,
  PK_SEPOLIA: PK_SEPOLIA,
  USE_NETWORK: NETWORK_PRIMARY,
  ICON_RPC_URL: config.rpc[NETWORK_PRIMARY],
  EVM_RPC_URL: config.rpc[NETWORK_SECONDARY],
  NID: config.nid[NETWORK_PRIMARY],
  jarPath: "./contracts/jvm/VotingDapp/build/libs/VotingDapp-optimized.jar",
  solPath: "./contracts/solidity/build/VotingDapp.json",
  xcallAbiPath: "./utils/xcallAbi.json",
  XCALL_PRIMARY: config.contract[NETWORK_PRIMARY].xcall,
  XCALL_SECONDARY: config.contract[NETWORK_SECONDARY].xcall,
  NETWORK_LABEL_PRIMARY: config.network[NETWORK_PRIMARY].label,
  NETWORK_LABEL_SECONDARY: config.network[NETWORK_SECONDARY].label,
  deploymentsPath: "./deployments.json"
};
