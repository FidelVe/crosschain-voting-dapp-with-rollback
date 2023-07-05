const VotingDapp = artifacts.require("VotingDapp.sol");
const config = require("../../../config");

module.exports = deployer => {
  const xcall = config.contract.sepolia.xcall;
  deployer.deploy(VotingDapp, xcall);
};
