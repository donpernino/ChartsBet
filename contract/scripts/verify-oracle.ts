import { ethers } from 'hardhat';

async function main() {
	const chartsBetAddress = '0xFa9D017a1b04d9AA82c350EDebDeea60641e1537'; // New ChartsBet address
	const chartsOracleAddress = '0x54287139da4222664d61e321f0096E3C044a73d4'; // New ChartsOracle address
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
