import { ethers } from 'hardhat';

async function createLeaderboard() {
	const chartsBetAddress = '0x5E19a6eA59F28B8AB96c08cc10064CF0Ce5E1Bb2'; // Replace with actual address
	const ChartsBet = await ethers.getContractFactory('ChartsBet');
	const chartsBet = ChartsBet.attach(chartsBetAddress);

	console.log('Connected to ChartsBet at:', chartsBetAddress);

	const [signer] = await ethers.getSigners();

	console.log('Using account:', signer.address);

	const country = 'IT';
	const countryBytes = ethers.encodeBytes32String(country);

	try {
		const tx1 = await chartsBet.createLeaderboard(countryBytes);
		console.log('Transaction 1 sent. Hash:', tx1.hash);
		await tx1.wait();
		console.log('Leaderboard created successfully for IT');

		const tx2 = await chartsBet.closeLeaderboard(countryBytes);
		console.log('Transaction 2 sent. Hash:', tx2.hash);
		await tx2.wait();
		console.log('Leaderboard closed successfully for IT');
	} catch (error) {
		console.error('Error creating leaderboard:', error.message);
	}
}

createLeaderboard().catch((error) => {
	console.error(error);
	process.exit(1);
});
