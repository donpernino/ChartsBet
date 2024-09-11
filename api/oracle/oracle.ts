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

const test_countries: string[] = ['FR', 'US'];
const prod_countries: string[] = [
	'WW',
	'BR',
	'DE',
	'ES',
	'FR',
	'IT',
	'PT',
	'US',
];

const countries = test_countries;

function stringToBytes32(str: string): string {
	return ethers.encodeBytes32String(str);
}

async function closeAllPoolsAndAnnounceWinners() {
	console.log('Closing all pools and announcing winners...');
	try {
		const nonce = await wallet.getNonce();

		const closePromises = countries.map(async (country, index) => {
			try {
				const response = await axios.get(
					`http://localhost:8080/daily-winner/${country}`
				);
				const winner = stringToBytes32(response.data);
				console.log(
					`Announcing winner for ${country}: ${response.data} -> ${winner}`
				);

				// Check if the pool is already closed
				const pool = await contract.dailyPools(
					stringToBytes32(country),
					await contract.currentDay()
				);
				if (pool.closed) {
					console.warn(`Pool for ${country} is already closed.`);
					return; // Avoid trying to close it again
				}

				// Use the nonce + index to ensure unique nonces for each transaction
				const tx = await contract.closePoolAndAnnounceWinner(
					stringToBytes32(country),
					winner,
					{
						gasLimit: 1000000, // Increased gas limit
						nonce: nonce + index,
					}
				);

				const receipt = await tx.wait();
				console.log(
					`Closed pool and announced winner for ${country}. Transaction hash: ${receipt.hash}`
				);

				// Check if the pool is actually closed
				const updatedPool = await contract.dailyPools(
					stringToBytes32(country),
					await contract.currentDay()
				);
				if (!updatedPool.closed) {
					console.warn(
						`Warning: Pool for ${country} may not have been closed successfully.`
					);
				}
			} catch (error) {
				console.error(`Error closing pool for ${country}:`, error);
				if (error.code === 'CALL_EXCEPTION') {
					console.error('Contract error details:', error.errorArgs);
				}
			}
		});

		await Promise.all(closePromises);
		console.log('All pools closed and winners announced');
	} catch (error) {
		console.error(
			'Error in closing all pools and announcing winners:',
			error
		);
	}
}

async function openPoolsAndUpdateTop10() {
	try {
		console.log('Opening daily pools and updating top 10...');
		const tx = await contract.openAllDailyPools({ gasLimit: 1000000 }); // Increased gas limit
		const receipt = await tx.wait();
		console.log(
			`Opened all daily pools. Transaction hash: ${receipt.hash}`
		);

		for (const country of countries) {
			await updateTop10(country);
		}
		console.log('Daily pools opened and top 10 updated successfully');
	} catch (error) {
		console.error('Error in daily pool opening and top 10 update:', error);
	}
}

async function updateTop10(country: string) {
	try {
		const response = await axios.get(
			`http://localhost:8080/leaderboard/${country}?compact=true`
		);
		const top10 = response.data.slice(0, 10).map(stringToBytes32);

		console.log(`Updating top 10 for ${country}:`, top10);

		const tx = await contract.updateTop10(stringToBytes32(country), top10, {
			gasLimit: 1000000, // Increased gas limit
		});
		const receipt = await tx.wait();
		console.log(
			`Updated top 10 for ${country}. Transaction hash: ${receipt.hash}`
		);
	} catch (error) {
		console.error(`Error updating top 10 for ${country}:`, error);
	}
}

async function runDailyTasks() {
	await closeAllPoolsAndAnnounceWinners();
	await openPoolsAndUpdateTop10();
}

async function main() {
	try {
		const owner = await contract.owner();
		const isWalletOwner =
			owner.toLowerCase() === wallet.address.toLowerCase();
		if (!isWalletOwner) {
			console.error(
				'The wallet is not the contract owner. This may cause permission issues.'
			);
			return;
		}

		console.log('Starting daily tasks...');
		await runDailyTasks();
		console.log('Daily tasks completed.');

		cron.schedule('0 0 * * *', runDailyTasks);
		console.log('Oracle started, waiting for scheduled executions...');
	} catch (error) {
		console.error('Error in main function:', error);
	}
}

main().catch(console.error);
