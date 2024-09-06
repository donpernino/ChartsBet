import { ethers } from 'ethers';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const { PRIVATE_KEY_0, ALCHEMY_API_KEY, CONTRACT_ADDRESS } = process.env;

const API_URL = `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const PRIVATE_KEY = PRIVATE_KEY_0;

if (!API_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
	throw new Error('Missing environment variables');
}

console.log('Contract address:', CONTRACT_ADDRESS);

// Read the ABI from the JSON file
const abiPath = path.join(
	__dirname,
	'..',
	'..',
	'contract',
	'artifacts',
	'contracts',
	'ChartsBet.sol',
	'ChartsBet.json'
);
const chartsBetJson = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

const provider = new ethers.JsonRpcProvider(API_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const contract = new ethers.Contract(
	CONTRACT_ADDRESS,
	chartsBetJson.abi,
	wallet
);

console.log(
	`Oracle started. Listening for events on contract: ${CONTRACT_ADDRESS}`
);

// Log all events
contract.on('*', (event) => {
	console.log('Event received:', event);
});

contract.on('LeaderboardCreated', async (countryBytes32: string) => {
	const country = ethers.decodeBytes32String(countryBytes32);

	console.log(
		`[${new Date().toISOString()}] LeaderboardCreated event received for ${country}`
	);

	console.log(`Fetching leaderboard data for ${country}...`);
	const response = await fetch(
		`http://localhost:8080/leaderboard/${country}?compact=true`
	);
	console.log('response', response);
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}
	const topArtists = await response.json();

	const topArtistsBytes32 = [];

	topArtists.forEach((artist: string) => {
		topArtistsBytes32.push(ethers.encodeBytes32String(artist));
	});

	console.log({ topArtistsBytes32 });

	const tx = await contract.fulfillTopArtists(
		countryBytes32,
		topArtistsBytes32
	);
	console.log(`Transaction sent. Hash: ${tx.hash}`);
	const receipt = await tx.wait();
	console.log(`Transaction mined in block ${receipt.blockNumber}`);
	console.log(
		`[${new Date().toISOString()}] Top artists for ${country} updated on-chain`
	);
});

// Global error handling
process.on('unhandledRejection', (error: Error) => {
	console.error(
		`[${new Date().toISOString()}] Unhandled promise rejection:`,
		error
	);
});

// Keep the script running
process.on('SIGINT', () => {
	console.log('Oracle stopped');
	process.exit();
});
