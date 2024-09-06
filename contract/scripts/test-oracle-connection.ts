import { ethers } from 'hardhat';

async function main() {
	const chartsBetAddress = '0x5E19a6eA59F28B8AB96c08cc10064CF0Ce5E1Bb2';
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
