import { ethers } from 'hardhat';

async function checkChartsBet(artist: string) {
	const chartsBetAddress = '0x1cf082e63a9127dF98EC74c8145c55034967Ff6D';
	const ChartsBet = await ethers.getContractFactory('ChartsBet');
	const chartsBet = ChartsBet.attach(chartsBetAddress);

	console.log('Connected to ChartsBet at:', chartsBetAddress);

	const [signer] = await ethers.getSigners();
	console.log('Using account:', signer.address);

	// Check if the contract is paused
	const isPaused = await chartsBet.paused();
	console.log('Contract paused:', isPaused);

	if (isPaused) {
		console.log('Cannot place bet. Contract is paused.');
		return;
	}

	const country = 'WW';
	const countryBytes = ethers.encodeBytes32String(country);

	// 1. Check if the country code is valid
	const isValidCountry = await chartsBet.validCountries(countryBytes);
	console.log('Is valid country:', isValidCountry);

	if (!isValidCountry) {
		console.log('Invalid country code.');
		return;
	}

	// 2. Check if the leaderboard exists and is open
	const leaderboard = await chartsBet.leaderboards(countryBytes);
	console.log('Leaderboard exists:', leaderboard.country !== ethers.ZeroHash);
	console.log('Leaderboard is open:', !leaderboard.isClosed);

	if (leaderboard.country === ethers.ZeroHash) {
		console.log('Leaderboard does not exist for this country.');
		return;
	}

	if (leaderboard.isClosed) {
		console.log('Leaderboard is closed for betting.');
		return;
	}

	// 3. Check if the artist is in the list of top artists (has odds assigned)
	const artistOdds = await chartsBet.getArtistOdds(countryBytes, artist);
	console.log('Artist odds:', artistOdds.toString());

	if (artistOdds.toString() === '0') {
		console.log(
			'Artist is not in the list of top artists or has no odds assigned.'
		);
		return;
	}

	// 4. Check if the betting period is still active
	const isExpired = await chartsBet.isLeaderboardExpired(countryBytes);
	console.log('Betting period expired:', isExpired);

	if (isExpired) {
		console.log('Betting period has expired for this leaderboard.');
		return;
	}

	console.log('All checks passed. You should be able to place a bet.');

	// Simulate placing a bet
	try {
		const betAmount = ethers.parseEther('0.0001'); // 0.0001 ETH
		const estimatedGas = await chartsBet.placeBet.estimateGas(
			countryBytes,
			artist,
			{ value: betAmount }
		);
		console.log('Estimated gas for placing bet:', estimatedGas.toString());

		// NOTE: This doesn't actually send the transaction, it just estimates the gas
		console.log('Bet can be placed successfully.');
	} catch (error) {
		console.error('Error estimating gas for placing bet:', error.message);
		if (error.data) {
			try {
				const decodedError = ChartsBet.interface.parseError(error.data);
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
	const artist = 'Lady Gaga';
	console.log(`\nChecking for country: WW, artist: ${artist}`);
	await checkChartsBet(artist);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
