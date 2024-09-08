const { ethers } = require('ethers');
const fs = require('fs');
import dotenv from 'dotenv';

dotenv.config();

const { PRIVATE_KEY_0, ALCHEMY_API_KEY } = process.env;

const API_URL = `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const PRIVATE_KEY = PRIVATE_KEY_0;

if (!API_URL || !PRIVATE_KEY) {
	throw new Error('Missing environment variables');
}

// Load ABIs
const ChartsBetTokenABI = JSON.parse(
	fs.readFileSync(
		'./artifacts/contracts/ChartsBetToken.sol/ChartsBetToken.json'
	)
).abi;
const ChartsBetABI = JSON.parse(
	fs.readFileSync('./artifacts/contracts/ChartsBet.sol/ChartsBet.json')
).abi;

// Load bytecode
const ChartsBetTokenBytecode = JSON.parse(
	fs.readFileSync(
		'./artifacts/contracts/ChartsBetToken.sol/ChartsBetToken.json'
	)
).bytecode;
const ChartsBetBytecode = JSON.parse(
	fs.readFileSync('./artifacts/contracts/ChartsBet.sol/ChartsBet.json')
).bytecode;

async function main() {
	// Connect to the network
	const provider = new ethers.JsonRpcProvider(API_URL);
	const signer = new ethers.Wallet(PRIVATE_KEY, provider);

	console.log(
		'Deploying contracts with the account:',
		await signer.getAddress()
	);

	// Deploy ChartsBetToken
	const ChartsBetTokenFactory = new ethers.ContractFactory(
		ChartsBetTokenABI,
		ChartsBetTokenBytecode,
		signer
	);
	const chartsBetToken = await ChartsBetTokenFactory.deploy(
		await signer.getAddress()
	);
	await chartsBetToken.deployed();
	console.log('ChartsBetToken deployed to:', chartsBetToken.address);

	// Deploy ChartsBet
	const ChartsBetFactory = new ethers.ContractFactory(
		ChartsBetABI,
		ChartsBetBytecode,
		signer
	);
	const chartsBet = await ChartsBetFactory.deploy(
		await signer.getAddress(),
		chartsBetToken.address
	);
	await chartsBet.deployed();
	console.log('ChartsBet deployed to:', chartsBet.address);

	// Initialize ChartsBet
	const initializeTx = await chartsBet.initialize();
	await initializeTx.wait();
	console.log('ChartsBet initialized');

	console.log('Deployment completed successfully!');
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
