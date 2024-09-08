import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import axios from 'axios';

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

const countries = ['WW', 'BR', 'DE', 'ES', 'FR', 'IT', 'PT', 'US'];

// Function to convert string to bytes32
function stringToBytes32(str) {
	return ethers.encodeBytes32String(str);
}

// Function to open all pools
async function openPoolsAndUpdateTop10() {
	try {
		// Open all pools
		const openTx = await contract.openAllDailyPools();
		await openTx.wait();
		console.log('All pools have been opened for the day');

		// Update top 10 for each country
		for (const country of countries) {
			await updateTop10(country);
		}
	} catch (error) {
		console.error('Error in daily pool opening and top 10 update:', error);
	}
}

// Function to update top 10 artists
async function updateTop10(country) {
	try {
		const response = await axios.get(
			`http://localhost:8080/leaderboard/${country}?compact=true`
		);
		const top10 = response.data.slice(0, 10).map(stringToBytes32);
		const tx = await contract.updateTop10(stringToBytes32(country), top10);
		await tx.wait();
		console.log(`Top 10 updated for ${country}`);
	} catch (error) {
		console.error(`Error updating top 10 for ${country}:`, error);
	}
}

// Function to close pool and announce winner
async function closePoolAndAnnounceWinner(country) {
	try {
		const response = await axios.get(
			`http://localhost:8080/daily-winner/${country}`
		);
		const winner = stringToBytes32(response.data);
		const currentDay = Math.floor(Date.now() / 86400000); // Current day
		const tx = await contract.closePoolAndAnnounceWinner(
			stringToBytes32(country),
			currentDay,
			winner
		);
		await tx.wait();
		console.log(`Pool closed and winner announced for ${country}`);
	} catch (error) {
		console.error(`Error closing pool for ${country}:`, error);
	}
}

// Task scheduling

// Open pools and update top 10 every day at midnight
cron.schedule('0 0 * * *', () => {
	openPoolsAndUpdateTop10();
});

// Close pools and announce winners every day at 23:59
cron.schedule('59 23 * * *', () => {
	countries.forEach((country) => closePoolAndAnnounceWinner(country));
});

// Immediately open pools and update top 10 when the script starts
openPoolsAndUpdateTop10();

console.log('Oracle started, waiting for scheduled executions...');
