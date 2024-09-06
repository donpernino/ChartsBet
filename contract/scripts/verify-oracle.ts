import { ethers } from 'hardhat';

async function main() {
	const chartsBetAddress = '0x1781BF835f3CE85a75792f30c83B5B6d3e20E885'; // New ChartsBet address
	const chartsOracleAddress = '0xd61cbb1302C5c8Ff2CBD726Eb8Ff6440A932A139'; // New ChartsOracle address
	console.log('ChartsBet address:', chartsBetAddress);
	console.log('ChartsOracle address:', chartsOracleAddress);

	// Check network connection
	const network = await ethers.provider.getNetwork();
	console.log(
		'Connected to network:',
		network.name,
		'chainId:',
		network.chainId
	);

	// Verify contract deployment
	const provider = ethers.provider;
	const code = await provider.getCode(chartsBetAddress);

	if (code === '0x') {
		console.log('No contract deployed at this address');
		return;
	} else {
		console.log('Contract is deployed. Bytecode length:', code.length);
	}

	const ChartsBet = await ethers.getContractFactory('ChartsBet');
	const chartsBet = ChartsBet.attach(chartsBetAddress);

	// Try to call view functions
	try {
		const oracleAddress = await chartsBet.oracle();
		console.log('Oracle address:', oracleAddress);
	} catch (error) {
		console.error('Error calling oracle():', error);
	}

	try {
		const owner = await chartsBet.owner();
		console.log('Contract owner:', owner);
	} catch (error) {
		console.error('Error calling owner():', error);
	}

	try {
		const paused = await chartsBet.paused();
		console.log('Contract paused:', paused);
	} catch (error) {
		console.error('Error calling paused():', error);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
