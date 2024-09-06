import { ethers } from 'hardhat';

async function main() {
	const chartsBetAddress = '0x1781BF835f3CE85a75792f30c83B5B6d3e20E885';
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
