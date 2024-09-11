# ChartsBet

## Overview

**ChartsBet** is a decentralized betting platform allowing users to bet on top-ranked musical artists in various countries.

## Project Structure

The project is structured as a monorepo with the following components:

-   **api/**: The backend server, which fetches leaderboard data from the Spotify API and communicates with the smart contract.
-   **contract/**: Ethereum smart contracts managing the betting system, developed using Solidity and Hardhat.
-   **dapp/**: The frontend decentralized application (dApp) built with React and Next.js.

## Getting Started

### Prerequisites

Before you begin, ensure that the following are installed:

-   [Node.js](https://nodejs.org/)
-   [npm](https://www.npmjs.com/)
-   [Hardhat](https://hardhat.org/)
-   [MetaMask](https://metamask.io/) (or another Ethereum wallet)

### Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/donpernino/ChartsBet
cd ChartsBet
npm install
```

### Environment Variables

#### api .env file example

```bash
# API KEYS
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
ALCHEMY_API_KEY=your_alchemy_api_key

# WALLET
PRIVATE_KEY_0=your_private_wallet_key

SPOTIFY_TOP_50_WORLD_PLAYLIST_ID=test123

CONTRACT_ADDRESS=your_contract_address
```

#### contract .env file example

```bash
# GAS REPORTER
REPORT_GAS=true

# API KEYS
ALCHEMY_API_KEY=your_alchemy_api_key
COINMARKETCAP_API_KEY=your_coinmarket_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# WALLET
PRIVATE_KEY_0=0your_private_wallet_key
PRIVATE_KEY_1=your_private_wallet_key
```

#### dapp .env file example

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# API KEYS
ALCHEMY_API_KEY=your_alchemy_api_key

# ADDRESS
NEXT_PUBLIC_CONTRACT_ADDRESS=your_contract_address
```

### Running the Project

To start the API, Oracle, and dApp, use the following commands:

```bash

# Start the backend API server

npm run start-server

# Start the Oracle to fetch daily updates

npm run start-oracle

# Start the frontend dApp

npm run start-dapp
```
