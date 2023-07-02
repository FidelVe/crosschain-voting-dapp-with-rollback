// Imports
const lib = require("./lib");

async function main() {
  try {
    const params = lib.getDappDeploymentsParams();
    console.log("params", params);

    const receipt = await lib.deployContract(params);
    console.log(receipt);

    const txResult = await lib.getTxResult(receipt);
    console.log("txResult", txResult);

    // const scoreApi = await lib.getScoreApi(txResult.scoreAddress);
    // console.log("scoreApi", scoreApi.getList());
  } catch (e) {
    console.log("error runninn main", e);
  }
}

main();
