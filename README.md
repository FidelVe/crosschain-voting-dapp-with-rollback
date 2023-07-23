# Crosschain voting dapp with rollback

The following is a cross chain dApp to showcase ICON xCall, it consists of a set of smart contracts deployed on Berlin (ICON) and Sepolia (Ethereum) to cast votes on the ICON chain and it will keep a ledger of the votes on both chains.

The smart contract on Berlin has a set of methods called `voteYes()` and `voteNo()` to cast a vote either for "No" or for "Yes", it saves the votes internally and then sends a cross chain message using xCall to the contract on the Sepolia network.

The contract on the Sepolia network receives the cross chain message and updates the ledger inside the smart contract.

To showcase the rollback functionality of xCall, the smart contract on Sepolia has a max cap on the allowed amount of votes that can be casted, once this number is reached a revert occurs on the smart contract and xCall triggers the rollback process.

Once the rollback is received on the origin chain, the java smart contract reverts the vote originally casted.

## Setup

Create a `.env` file in the root folder and place the private keys of a wallet on Berlin and Sepolia with enough balance to deploy and run the DApp test scenarios.
```bash
PK_BERLIN="ICON WALLET PRIVATE KEY"
PK_SEPOLIA="ETHEREUM WALLET PRIVATE KEY"
```

Run command to install node packages.
```
npm install
```

## Compile contracts

To run the project you first need to compile both the java and solidity contracts.

To compile the solidity contract run the following command:
```
npm run compile-solidity
```

To compile the Java contracts move into the `./contracts/jvm/` folder and run the compilation command with gradle.
```
cd contracts/jvm/
./gradlew b
./gradlew op
```

## Run Tests

To run tests for the Java contract move into the `./contracts/jvm/` folder and run the gradle test command.
```
cd contracts/jvm/
./gradlew clean test
```

To run tests for the Solidity contract use the following command:
``` bash
npm run test-solidity
```

## Run main script

Once you had compiled the solidity and java contracts you can run the main script with the following command
```
npm run start
```

If this is the first time running the command, the compiled solidity and java contracts will be deployed to berlin and sepolia networks, after that the script will execute a full example by casting a vote on the Berlin chain and then checking the votes ledger on the Sepolia network.

## Further resources

- [btp](https://github.com/icon-project/btp2) - Blockchain Transmission Protocol, which is the ICON Foundation's core interoperability product
- [iconloop/btp2-testnet](https://github.com/iconloop/btp2-testnet) - Information on the BTP network connected to the ICON Berlin TestNet.
- [fidelve/xcall-sample-dapp](https://github.com/FidelVe/xcall-sample-dapp) - xCall sample dApp written in javascript.
- [R0bi7/xCall-testing-JVM](https://github.com/R0bi7/xCall-testing-JVM) - Sample JVM smart contract that interacts with xCall.
- [R0bi7/xCall-testing-EVM](https://github.com/R0bi7/xCall-testing-EVM) - Sample EVM smart contract that interacts with xCall.
- [R0bi7/xCall-testing-dApp](https://github.com/R0bi7/xCall-testing-dApp/tree/master) - Sample DApp that interacts with xCall.
