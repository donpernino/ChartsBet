import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'dotenv/config';
import 'hardhat-gas-reporter';

const {
	ALCHEMY_API_KEY,
	ETHERSCAN_API_KEY,
	PRIVATE_KEY_0,
	PRIVATE_KEY_1,
	COINMARKETCAP_API_KEY,
} = process.env;

const config: HardhatUserConfig = {
	solidity: '0.8.24',
	networks: {
		amoy: {
			url: `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
			accounts: [`0x${PRIVATE_KEY_0}`, `0x${PRIVATE_KEY_1}`],
			gas: 20000000,
			gasPrice: 30000000000,
			ignition: {
				maxFeePerGasLimit: 50_000_000_000n,
				maxPriorityFeePerGas: 2_000_000_000n,
			},
		},
		hardhat: {
			allowUnlimitedContractSize: true,
		},
	},
	gasReporter: {
		currency: 'EUR',
		L1: 'polygon',
		coinmarketcap: COINMARKETCAP_API_KEY,
	},
	etherscan: {
		enabled: true,
		apiKey: ETHERSCAN_API_KEY,
	},
};

export default config;
