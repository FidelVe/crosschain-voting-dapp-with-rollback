// Imports
const lib = require("./lib");

async function main() {
  const params = { _callService: lib.config.contract.xcall };
  console.log("params", params);

  const receipt = await lib.deployContract(params);
  console.log(receipt);

  const txResult = await lib.getTxResult(receipt);
  console.log("txResult", txResult);

  const scoreApi = await lib.getScoreApi(txResult.scoreAddress);
  console.log("scoreApi", scoreApi.getList());
}

main();
