// Imports
const {
  deployIcon,
  deployEvm,
  isDeployed,
  getDeployments,
  saveDeployments
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

async function tests() {
  try {
    console.log("Test coming soon..");
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
      await tests();
    }
  } catch (e) {
    console.log("error running main", e);
  }
}

main();
