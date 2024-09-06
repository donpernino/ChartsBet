import { ethers } from 'hardhat';

async function requestDailyWinner(country: string) {
	const chartsOracleAddress = '0x939F96BFC5BC9BeA71cc047209458dD50D01DF1F';
	const ChartsOracle = await ethers.getContractFactory('ChartsOracle');
	const chartsOracle = ChartsOracle.attach(chartsOracleAddress);

	console.log('Connected to ChartsOracle at:', chartsOracleAddress);

	const [signer] = await ethers.getSigners();
	console.log('Using account:', signer.address);

	// Check if the contract is paused
	const isPaused = await chartsOracle.paused();
	console.log('Contract paused:', isPaused);

	if (isPaused) {
		console.log('Cannot request daily winner. Contract is paused.');
		return;
	}

	// Check if the signer is the owner
	const owner = await chartsOracle.owner();
	console.log('Contract owner:', owner);
	console.log('Is signer the owner:', signer.address === owner);

	const countryBytes = ethers.encodeBytes32String(country);

	console.log(`Requesting daily winner for ${country}...`);

	try {
		// Try to estimate gas first
		const estimatedGas = await chartsOracle.requestDailyWinner.estimateGas(
			countryBytes
		);
		console.log('Estimated gas:', estimatedGas.toString());

		// If gas estimation succeeds, send the transaction
		const tx = await chartsOracle.requestDailyWinner(countryBytes, {
			gasLimit: (estimatedGas * 120n) / 100n, // Increase gas limit by 20%
		});

		console.log('Transaction sent. Hash:', tx.hash);
		console.log('Waiting for transaction to be mined...');

		const receipt = await tx.wait();
		console.log('Transaction mined. Block number:', receipt.blockNumber);

		const event = receipt.logs
			.map((log) => ChartsOracle.interface.parseLog(log))
			.find((event) => event && event.name === 'RequestDailyWinner');

		if (event) {
			const [requestId, eventCountry] = event.args;
			console.log('RequestDailyWinner event emitted:');
			console.log('  Request ID:', requestId);
			console.log('  Country:', ethers.decodeBytes32String(eventCountry));
		} else {
			console.log('RequestDailyWinner event not found in the logs');
		}
	} catch (error) {
		console.error('Error requesting daily winner:', error.message);
		if (error.data) {
			try {
				const decodedError = ChartsOracle.interface.parseError(
					error.data
				);
				if (decodedError) {
					console.error(
						'Decoded error:',
						decodedError.name,
						decodedError.args
					);
				}
			} catch (parseError) {
				console.error('Could not parse error data:', error.data);
			}
		}
	}
}

async function main() {
	const countries = ['FR', 'US', 'DE', 'ES']; // Add more country codes as needed
	for (const country of countries) {
		console.log(`\nTrying country: ${country}`);
		await requestDailyWinner(country);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
