const VotingDapp = artifacts.require("VotingDapp.sol");
const config = require("../../../config");

module.exports = (deployer, network, accounts) => {
  // const xcall = config.contract.sepolia.xcall;
  const deployerAccount = accounts[0];
  deployer.deploy(VotingDapp, deployerAccount);
};
