import { ethers } from 'hardhat';

async function main() {
	const chartsBetAddress = '0xfC452e21690ddfb842c95Eb55C9004b46E909D35';
	const ChartsBet = await ethers.getContractFactory('ChartsBet');
	const chartsBet = ChartsBet.attach(chartsBetAddress);

	console.log('Testing oracle connection...');
	const tx = await chartsBet.testOracleConnection();
	await tx.wait();
	console.log('Test event emitted for country TEST. Check oracle logs.');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
