# Crosschain voting dapp

This is cross chain DApp to showcase ICON XCall, it consists of a set of smart contracts deployed on Berlin (ICON) and Sepolia (Ethereum) to cast votes on the ICON chain and it will keep a ledger of the votes on both chains.

## Setup

Create a `.env` file in the root folder and place the private keys of a wallet on Berlin and Sepolia with enough balance to deploy and run the DApp test scenarios.
```bash
PK_BERLIN="ICON WALLET PRIVATE KEY"
PK_SEPOLIA="ETHEREUM WALLET PRIVATE KEY"
```
