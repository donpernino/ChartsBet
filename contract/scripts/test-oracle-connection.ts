import { ethers } from 'hardhat';

async function main() {
	const chartsBetAddress = '0x1cf082e63a9127dF98EC74c8145c55034967Ff6D';
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
