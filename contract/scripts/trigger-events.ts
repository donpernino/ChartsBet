import { ethers } from 'hardhat';

async function main() {
	const chartsBetAddress = '0xFa9D017a1b04d9AA82c350EDebDeea60641e1537';
	const ChartsBet = await ethers.getContractFactory('ChartsBet');
	const chartsBet = ChartsBet.attach(chartsBetAddress);

	console.log('Connected to ChartsBet at:', chartsBetAddress);

	const [signer] = await ethers.getSigners();
	console.log('Using account:', signer.address);

	const owner = await chartsBet.owner();
	console.log('Contract owner:', owner);

	const isPaused = await chartsBet.paused();
	console.log('Contract paused:', isPaused);

	// Try with two different country codes
	const countries = ['FR', 'US'];

	for (const country of countries) {
		const countryBytes = ethers.encodeBytes32String(country);

		const isValidCountry = await chartsBet.validCountries(countryBytes);
		console.log(`Is ${country} a valid country:`, isValidCountry);

		try {
			const leaderboard = await chartsBet.leaderboards(countryBytes);
			console.log(`Existing leaderboard for ${country}:`, leaderboard);
		} catch (error) {
			console.log(`No existing leaderboard found for ${country}`);
		}

		if (!isPaused && isValidCountry) {
			console.log(`Attempting to create leaderboard for ${country}...`);
			try {
				const tx = await chartsBet.createLeaderboard(countryBytes, {
					gasLimit: 500000,
				});
				console.log('Transaction sent. Hash:', tx.hash);
				console.log('Waiting for transaction to be mined...');

				const receipt = await tx.wait();
				console.log(
					'Transaction mined. Block number:',
					receipt.blockNumber
				);
				console.log('Gas used:', receipt.gasUsed.toString());

				if (receipt.status === 1) {
					console.log(
						`Leaderboard created successfully for ${country}`
					);
				} else {
					console.log('Transaction failed');
				}
			} catch (error) {
				console.error(
					`Error creating leaderboard for ${country}:`,
					error.message
				);
				if (error.error && error.error.data) {
					try {
						const decodedError = ChartsBet.interface.parseError(
							error.error.data
						);
						if (decodedError) {
							console.error(
								'Decoded error:',
								decodedError.name,
								decodedError.args
							);
						}
					} catch (parseError) {
						console.error(
							'Could not parse error data:',
							error.error.data
						);
					}
				}
			}
		} else {
			console.log(
				`Cannot create leaderboard for ${country}. Check contract state and country validity.`
			);
		}

		console.log('\n'); // Add a newline for readability between countries
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
