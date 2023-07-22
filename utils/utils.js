const fs = require("fs");
const config = require("./config");
const customRequest = require("./customRequest");

const {
  contract,
  PK_BERLIN,
  PK_SEPOLIA,
  NID,
  ICON_RPC_URL,
  EVM_RPC_URL,
  jarPath,
  solPath,
  XCALL_PRIMARY,
  XCALL_SECONDARY,
  NETWORK_LABEL_PRIMARY,
  NETWORK_LABEL_SECONDARY,
  deploymentsPath,
  xcallAbiPath,
  tracker
} = config;

/*
 * getIcoNContractByteCode - returns the byte code of the contract
 * @returns {string} - the byte code of the contract
 * @throws {Error} - if there is an error reading the contract
 */
function getIconContractByteCode() {
  try {
    return fs.readFileSync(jarPath).toString("hex");
  } catch (e) {
    console.log(e);
    throw new Error("Error reading contract info");
  }
}

/*
 * isDeployed - checks if the contract is deployed
 * @returns {boolean} - true if the contract is deployed, false otherwise
 * @throws {Error} - if there is an error checking the deployments
 */
function isDeployed() {
  try {
    return fileExists(deploymentsPath);
  } catch (e) {
    console.log(e);
    throw new Error("Error checking deployments");
  }
}

/*
 * fileExists- checks if the file exists
 * @returns {boolean} - true if the file exists, false otherwise
 * @throws {Error} - if there is an error checking the file
 */
function fileExists(path) {
  try {
    if (fs.existsSync(path)) {
      return true;
    }
    return false;
  } catch (e) {
    console.log(e);
    throw new Error(`Error checking file ${path}`);
  }
}
/*
 * saveDeployments - saves the deployments
 * @param {object} deployments - the deployments to save
 * @throws {Error} - if there is an error saving the deployments
 */
function saveDeployments(deployments) {
  try {
    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments));
  } catch (e) {
    console.log(e);
    throw new Error("Error saving deployments");
  }
}

/*
 * getDeployments - returns the deployments
 * @returns {object} - the deployments
 * @throws {Error} - if there is an error reading the deployments
 */
function getDeployments() {
  try {
    return JSON.parse(fs.readFileSync(deploymentsPath));
  } catch (e) {
    console.log(e);
    throw new Error("Error reading deployments");
  }
}

/*
 * getEvmContract - returns the EVM contract
 * @param {string} abiPath - the path to the EVM contract abi
 * @returns {object} - the EVM contract
 * @throws {Error} - if there is an error reading the EVM contract
 */
function getEvmContract(abiPath) {
  try {
    const result = {
      abi: null,
      bytecode: null
    };
    const contract = JSON.parse(fs.readFileSync(abiPath));
    result.abi = contract.abi;
    result.bytecode = contract.bytecode;
    return result;
  } catch (e) {
    console.log(e);
    throw new Error("Error reading EVM contract info");
  }
}

/*
 * getDappContract - returns the Dapp contract
 * @returns {object} - the Dapp contract
 * @throws {Error} - if there is an error reading the Dapp contract
 */
function getDappContract() {
  return getEvmContract(solPath);
}

/*
 * getXcallContract - returns the Xcall contract
 * @returns {object} - the Xcall contract
 * @throws {Error} - if there is an error reading the Xcall contract
 */
function getXcallContract() {
  return getEvmContract(xcallAbiPath);
}

/*
 * getIconDappDeploymentsParams - returns the params for the Icon contract
 * @param {string} label - the label of the network
 * @param {string} dappContract - the address of the Dapp contract
 * @returns {object} - the params for the Icon contract
 * @throws {Error} - if there is an error getting the params
 */
function getIconDappDeploymentsParams(label, dappContract) {
  const result = {
    _sourceXCallContract: XCALL_PRIMARY,
    _destinationBtpAddress: getBtpAddress(label, dappContract)
  };
  return result;
}

/*
 * getBtpAddress - returns the BTP address
 * @param {string} label - the label of the network
 * @param {string} address - the address of the contract
 * @returns {string} - the BTP address
 * @throws {Error} - if there is an error getting the BTP address
 */
function getBtpAddress(label, address) {
  return `btp://${label}/${address}`;
}

function parseEventResponseFromTracker(response) {
  const result = response.map(event => {
    const indexed =
      event.indexed != null && typeof event.indexed === "string"
        ? JSON.parse(event.indexed)
        : [];
    return {
      ...event,
      scoreAddress: event.address,
      indexed: indexed
    };
  });
  return result;
}
/*
 * filterEventICON - filters the event logs
 * @param {object} eventlogs - the event logs
 * @param {string} sig - the signature of the event
 * @param {string} address - the address of the contract
 * @returns {object} - the filtered event logs
 * @throws {Error} - if there is an error filtering the event logs
 */
function filterEventICON(eventlogs, sig, address) {
  return eventlogs.filter(event => {
    return (
      event.indexed &&
      event.indexed[0] === sig &&
      (!address || address === event.scoreAddress)
    );
  });
}

/*
 * filterCallMessageSentEvent - filters the CallMessageSent event logs
 * @param {object} eventlogs - the event logs
 * @returns {object} - the filtered event logs
 * @throws {Error} - if there is an error filtering the event logs
 */
async function filterCallMessageSentEvent(eventlogs) {
  return filterEventICON(
    eventlogs,
    "CallMessageSent(Address,str,int,int)",
    XCALL_PRIMARY
  );
}

/*
 * sleep - sleeps for the specified time
 * @param {number} ms - the time to sleep
 * @returns {object} - async function
 */
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/*
 * strToHex - converts a string to hex
 * @param {string} str - the string to convert
 * @returns {string} - the hex string
 * @throws {Error} - if there is an error converting the string
 */
function strToHex(str) {
  var hex = "";
  for (var i = 0; i < str.length; i++) {
    hex += "" + str.charCodeAt(i).toString(16);
  }
  return "0x" + hex;
}

/*
 * strToHexPadded - converts a string to hex and pads it
 * @param {string} str - the string to convert
 * @returns {string} - the hex string
 * @throws {Error} - if there is an error converting the string
 */
function strToHexPadded(str) {
  var hex = "";
  for (var i = 0; i < str.length; i++) {
    hex +=
      "" +
      str
        .charCodeAt(i)
        .toString(16)
        .padStart(2, "0");
  }
  return "0x" + hex;
}

/*
 * isValidEVMAddress - checks if the address is valid
 * @param {string} address - the address to check
 * @returns {boolean} - true if the address is valid
 */
function isValidEVMAddress(address) {
  return address && address.length === 42 && address.startsWith("0x");
}

const utils = {
  // methods
  getIconContractByteCode,
  isDeployed,
  saveDeployments,
  getDeployments,
  getEvmContract,
  getDappContract,
  getXcallContract,
  getIconDappDeploymentsParams,
  getBtpAddress,
  filterEventICON,
  filterCallMessageSentEvent,
  sleep,
  strToHex,
  strToHexPadded,
  isValidEVMAddress,
  fileExists,
  // config values
  contract,
  PK_BERLIN,
  PK_SEPOLIA,
  NID,
  ICON_RPC_URL,
  EVM_RPC_URL,
  jarPath,
  solPath,
  XCALL_PRIMARY,
  XCALL_SECONDARY,
  NETWORK_LABEL_PRIMARY,
  NETWORK_LABEL_SECONDARY,
  deploymentsPath,
  xcallAbiPath,
  tracker,
  customRequest,
  parseEventResponseFromTracker
};

module.exports = utils;
