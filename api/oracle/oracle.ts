import { ethers } from 'ethers';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const { PRIVATE_KEY_0, ALCHEMY_API_KEY } = process.env;

const API_URL = `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const PRIVATE_KEY = PRIVATE_KEY_0;

if (!API_URL || !PRIVATE_KEY) {
	throw new Error('Missing environment variables');
}

const provider = new ethers.JsonRpcProvider(API_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Contract details
const contractAddress = 'your-contract-address';
const abi = [
	'event LeaderboardCreated(string country)',
	'event RequestWinningArtist(string country)', // Add this line to listen to the RequestWinningArtist event
	'function fulfillTopArtists(string memory country, string[] memory topArtists) public',
	'function fulfillDailyWinner(string memory country, string memory winningArtist) public',
];

const contract = new ethers.Contract(contractAddress, abi, wallet);

// Listen for the LeaderboardCreated event
contract.on('LeaderboardCreated', async (country: string) => {
	console.log(`Leaderboard created for ${country}`);

	// Fetch top 10 artists from your Node.js server
	try {
		const response = await fetch(
			`http://localhost:8080/leaderboard/${country}?compact=true`
		);
		const topArtists: string[] = await response.json(); // Assuming the API returns a JSON array of strings

		// Call the smart contract to fulfill the leaderboard
		const tx = await contract.fulfillTopArtists(country, topArtists);
		await tx.wait();
		console.log(`Top artists for ${country} updated on-chain`);
	} catch (error) {
		console.error(`Failed to update top artists for ${country}:`, error);
	}
});

// Listen for the RequestWinningArtist event
contract.on('RequestWinningArtist', async (country: string) => {
	console.log(`Request for winning artist received for ${country}`);

	// Fetch the daily winner from your Node.js server
	try {
		const response = await fetch(
			`http://localhost:8080/daily-winner/${country}`
		);
		const winningArtist: string = await response.json(); // Assuming the API returns the winner as a string

		// Call the smart contract to fulfill the daily winner
		const tx = await contract.fulfillDailyWinner(country, winningArtist);
		await tx.wait();
		console.log(`Winning artist for ${country} updated on-chain`);
	} catch (error) {
		console.error(`Failed to update winning artist for ${country}:`, error);
	}
});
