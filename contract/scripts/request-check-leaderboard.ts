import { ethers } from 'hardhat';

async function requestAndCheckLeaderboard() {
	const chartsOracleAddress = '0xd61cbb1302C5c8Ff2CBD726Eb8Ff6440A932A139';
	const ChartsOracle = await ethers.getContractFactory('ChartsOracle');
	const chartsOracle = ChartsOracle.attach(chartsOracleAddress);

	const chartsBetAddress = '0x1781BF835f3CE85a75792f30c83B5B6d3e20E885';
	const ChartsBet = await ethers.getContractFactory('ChartsBet');
	const chartsBet = ChartsBet.attach(chartsBetAddress);

	console.log('Connected to ChartsOracle at:', chartsOracleAddress);
	console.log('Connected to ChartsBet at:', chartsBetAddress);

	const [signer] = await ethers.getSigners();
	console.log('Using account:', signer.address);

	const country = 'WW';
	const countryBytes = ethers.encodeBytes32String(country);

	// Request leaderboard data
	console.log('Requesting leaderboard data for WW...');
	const tx = await chartsOracle.requestLeaderboardData(countryBytes);
	const receipt = await tx.wait();

	const requestEvent = receipt.logs
		.map((log) => ChartsOracle.interface.parseLog(log as any))
		.find((event) => event?.name === 'RequestLeaderboardData');

	if (requestEvent) {
		console.log('RequestLeaderboardData event emitted');
		console.log('Request ID:', requestEvent.args.requestId);
	} else {
		console.log('RequestLeaderboardData event not found');
	}

	// Check top artists (this won't be immediately populated)
	console.log('\nChecking top artists (may not be populated yet):');
	const artists = [
		'Lady Gaga',
		'Ed Sheeran',
		'Beyoncé',
		'Drake',
		'Taylor Swift',
		'Ariana Grande',
	];

	for (const artist of artists) {
		const odds = await chartsBet.getArtistOdds(countryBytes, artist);
		console.log(`${artist} odds:`, odds.toString());
	}

	console.log(
		'\nNote: The leaderboard data will be populated by an off-chain service.'
	);
	console.log(
		'You may need to wait and run a check script later to see the updated data.'
	);
}

async function main() {
	await requestAndCheckLeaderboard();
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
