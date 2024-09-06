import { ethers } from 'hardhat';

async function createLeaderboard() {
	const chartsBetAddress = '0xFa9D017a1b04d9AA82c350EDebDeea60641e1537'; // Replace with actual address
	const ChartsBet = await ethers.getContractFactory('ChartsBet');
	const chartsBet = ChartsBet.attach(chartsBetAddress);

	console.log('Connected to ChartsBet at:', chartsBetAddress);

	const [signer] = await ethers.getSigners();

	console.log('Using account:', signer.address);

	const country = 'WW';
	const countryBytes = ethers.encodeBytes32String(country);

	try {
		const tx = await chartsBet.createLeaderboard(countryBytes);
		console.log('Transaction sent. Hash:', tx.hash);
		await tx.wait();
		console.log('Leaderboard created successfully for WW');
	} catch (error) {
		console.error('Error creating leaderboard:', error.message);
	}
}

createLeaderboard().catch((error) => {
	console.error(error);
	process.exit(1);
});
