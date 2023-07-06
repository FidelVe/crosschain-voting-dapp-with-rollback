// Imports
const { deployIcon, deployEvm } = require("./lib");

async function main() {
  try {
    // deploying EVM contract
    const evmContractAddress = await deployEvm();
    console.log("\n# deployed EVM contract address:", evmContractAddress);

    // deploying ICON contract
    const iconContractAddress = await deployIcon(evmContractAddress);
    console.log("\n# deployed ICON contract address:", iconContractAddress);
  } catch (e) {
    console.log("error runninn main", e);
  }
}

main();
