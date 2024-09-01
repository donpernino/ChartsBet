import { ethers } from 'ethers';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const { PRIVATE_KEY_0, ALCHEMY_API_KEY, CONTRACT_ADDRESS } = process.env;

const API_URL = `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const PRIVATE_KEY = PRIVATE_KEY_0;

if (!API_URL || !PRIVATE_KEY) {
	throw new Error('Missing environment variables');
}

const provider = new ethers.JsonRpcProvider(API_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const abi = [
	'event LeaderboardCreated(string country)',
	'event RequestWinningArtist(string country)',
	'function fulfillTopArtists(string memory country, string[] memory topArtists) public',
	'function fulfillDailyWinner(string memory country, string memory winningArtist) public',
];

const contract = new ethers.Contract(CONTRACT_ADDRESS as string, abi, wallet);

console.log(
	`Oracle started. Listening for events on contract: ${CONTRACT_ADDRESS}`
);

contract.on('LeaderboardCreated', async (country) => {
	console.log(
		`[${new Date().toISOString()}] LeaderboardCreated event received for ${country}`
	);

	try {
		const response = await fetch(
			`http://localhost:8080/leaderboard/${country}?compact=true`
		);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		const topArtists = await response.json();
		console.log(`Fetched top artists for ${country}:`, topArtists);

		const tx = await contract.fulfillTopArtists(country, topArtists);
		console.log(`Transaction sent. Hash: ${tx.hash}`);
		await tx.wait();
		console.log(
			`[${new Date().toISOString()}] Top artists for ${country} updated on-chain`
		);
	} catch (error) {
		console.error(
			`[${new Date().toISOString()}] Failed to update top artists for ${country}:`,
			error
		);
	}
});

contract.on('RequestWinningArtist', async (country) => {
	console.log(
		`[${new Date().toISOString()}] RequestWinningArtist event received for ${country}`
	);

	try {
		const response = await fetch(
			`http://localhost:8080/daily-winner/${country}`
		);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		const winningArtist = await response.json();
		console.log(`Fetched winning artist for ${country}:`, winningArtist);

		const tx = await contract.fulfillDailyWinner(country, winningArtist);
		console.log(`Transaction sent. Hash: ${tx.hash}`);
		await tx.wait();
		console.log(
			`[${new Date().toISOString()}] Winning artist for ${country} updated on-chain`
		);
	} catch (error) {
		console.error(
			`[${new Date().toISOString()}] Failed to update winning artist for ${country}:`,
			error
		);
	}
});

// Error handling for contract events
contract.on('error', (error) => {
	console.error(`[${new Date().toISOString()}] Contract event error:`, error);
});

// Keep the script running
process.on('SIGINT', () => {
	console.log('Oracle stopped');
	process.exit();
});
