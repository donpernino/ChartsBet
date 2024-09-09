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

const countries: string[] = ['WW', 'BR', 'DE', 'ES', 'FR', 'IT', 'PT', 'US'];

function stringToBytes32(str: string): string {
	return ethers.encodeBytes32String(str);
}

function checkContractMethods() {
	const functions = contract.interface.fragments.filter(
		(f) => f.type === 'function'
	);
	functions.forEach((f) => {
		if ('name' in f) {
			console.log(`- ${f.name}`);
		}
	});

	if (!contract.interface.getFunction('openAllDailyPools')) {
		console.error('openAllDailyPools function not found in contract ABI');
		process.exit(1);
	}
}

async function checkContractState() {
	try {
		const currentDay = await contract.currentDay();
		const owner = await contract.owner();
		const isWalletOwner =
			owner.toLowerCase() === wallet.address.toLowerCase();

		if (!isWalletOwner) {
			console.error(
				'The wallet is not the contract owner. This may cause permission issues.'
			);
		}
	} catch (error) {
		console.error('Error checking contract state:', error);
	}
}

async function openPoolsAndUpdateTop10() {
	try {
		const data = contract.interface.encodeFunctionData('openAllDailyPools');
		const tx = await wallet.sendTransaction({
			to: contract.target,
			data: data,
			gasLimit: 500000,
		});

		const receipt = await tx.wait();

		if (receipt?.status === 0) {
			throw new Error('Transaction failed');
		}

		for (const country of countries) {
			await updateTop10(country);
		}
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

		const tx = await contract.updateTop10(stringToBytes32(country), top10, {
			gasLimit: 300000,
		});
		await tx.wait();
	} catch (error) {
		console.error(`Error updating top 10 for ${country}:`, error);
	}
}

async function closePoolAndAnnounceWinner(country: string) {
	try {
		const response = await axios.get(
			`http://localhost:8080/daily-winner/${country}`
		);
		const winner = stringToBytes32(response.data);
		const currentDay = Math.floor(Date.now() / 86400000);
		const tx = await contract.closePoolAndAnnounceWinner(
			stringToBytes32(country),
			currentDay,
			winner
		);
		await tx.wait();
	} catch (error) {
		console.error(`Error closing pool for ${country}:`, error);
	}
}

async function main() {
	checkContractMethods();
	await checkContractState();
	await openPoolsAndUpdateTop10();

	cron.schedule('0 0 * * *', () => {
		openPoolsAndUpdateTop10();
	});

	cron.schedule('59 23 * * *', () => {
		countries.forEach((country) => closePoolAndAnnounceWinner(country));
	});

	console.log('Oracle started, waiting for scheduled executions...');
}

main().catch(console.error);
