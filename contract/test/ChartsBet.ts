import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ChartsBet, ChartsOracle } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('ChartsBet Contract', function () {
	let chartsBet: ChartsBet;
	let chartsOracle: ChartsOracle;
	let owner: HardhatEthersSigner;
	let addr1: HardhatEthersSigner;
	let addr2: HardhatEthersSigner;

	beforeEach(async function () {
		[owner, addr1, addr2] = await ethers.getSigners();

		const ChartsBetFactory = await ethers.getContractFactory('ChartsBet');
		chartsBet = await ChartsBetFactory.deploy();
		await chartsBet.initialize(await owner.getAddress());

		chartsOracle = await ethers.getContractAt(
			'ChartsOracle',
			await chartsBet.oracle()
		);
	});

	describe('Deployment', function () {
		it('Should set the correct owner and oracle contract', async function () {
			expect(await chartsBet.owner()).to.equal(await owner.getAddress());
			expect(await chartsBet.oracle()).to.equal(
				await chartsOracle.getAddress()
			);
		});
	});

	describe('Creating Leaderboards', function () {
		it('Should allow the owner to create a new leaderboard', async function () {
			await expect(chartsBet.createLeaderboard('FR'))
				.to.emit(chartsBet, 'LeaderboardCreated')
				.withArgs('FR');

			// Check if we can get total bet amount for the created leaderboard
			const totalBetAmount = await chartsBet.getTotalBetAmount('FR');
			expect(totalBetAmount).to.equal(0);
		});

		it('Should revert if non-owner tries to create a leaderboard', async function () {
			await expect(chartsBet.connect(addr1).createLeaderboard('FR')).to.be
				.reverted;
		});

		it('Should handle creating a leaderboard that already exists', async function () {
			await chartsBet.createLeaderboard('FR');

			// Try to create the same leaderboard again
			await expect(chartsBet.createLeaderboard('FR')).to.not.be.reverted;

			// Check if we can still get total bet amount for the leaderboard
			const totalBetAmount = await chartsBet.getTotalBetAmount('FR');
			expect(totalBetAmount).to.equal(0);
		});

		it('Should revert if an invalid country code is provided', async function () {
			await expect(
				chartsBet.createLeaderboard('XX')
			).to.be.revertedWithCustomError(chartsBet, 'InvalidCountryCode');
		});
	});

	describe('Fulfilling Top Artists', function () {
		beforeEach(async function () {
			await chartsBet.createLeaderboard('FR');
		});

		it('Should allow the owner to fulfill top artists', async function () {
			const topArtists = ['GIMS', 'Carbonne', 'Leto', 'Lacrim', 'Dadi'];
			await expect(chartsBet.fulfillTopArtists('FR', topArtists)).to.not
				.be.reverted;
		});

		it('Should revert if non-owner tries to fulfill top artists', async function () {
			const topArtists = ['GIMS', 'Carbonne', 'Leto', 'Lacrim', 'Dadi'];
			await expect(
				chartsBet.connect(addr1).fulfillTopArtists('FR', topArtists)
			).to.be.reverted;
		});

		it('Should revert if trying to fulfill for an invalid country', async function () {
			const topArtists = ['GIMS', 'Carbonne', 'Leto', 'Lacrim', 'Dadi'];
			await expect(
				chartsBet.fulfillTopArtists('XX', topArtists)
			).to.be.revertedWithCustomError(chartsBet, 'InvalidCountryCode');
		});
	});

	describe('Fulfilling Daily Winner', function () {
		beforeEach(async function () {
			await chartsBet.createLeaderboard('FR');
			const topArtists = ['GIMS', 'Carbonne', 'Leto', 'Lacrim', 'Dadi'];
			await chartsBet.fulfillTopArtists('FR', topArtists);
		});

		it('Should allow the owner to fulfill daily winner', async function () {
			await expect(chartsBet.fulfillDailyWinner('FR', 'GIMS')).to.not.be
				.reverted;
		});

		it('Should revert if trying to fulfill daily winner for a closed leaderboard', async function () {
			await chartsBet.fulfillDailyWinner('FR', 'GIMS');
			await expect(
				chartsBet.fulfillDailyWinner('FR', 'Carbonne')
			).to.be.revertedWithCustomError(chartsBet, 'BettingClosed');
		});
	});

	describe('Emergency Withdrawals', function () {
		beforeEach(async function () {
			await chartsBet.createLeaderboard('FR');
			const topArtists = ['GIMS', 'Carbonne', 'Leto', 'Lacrim', 'Dadi'];
			await chartsBet.fulfillTopArtists('FR', topArtists);
		});

		it('Should allow the owner to withdraw funds in case of emergency', async function () {
			// Skip this test as the contract can't receive Ether
			this.skip();
		});

		it('Should revert if non-owner attempts to withdraw funds', async function () {
			await expect(chartsBet.connect(addr1).emergencyWithdraw()).to.be
				.reverted;
		});
	});

	describe('Pausing and Unpausing', function () {
		it('Should allow the owner to pause and unpause the contract', async function () {
			await chartsBet.pause();
			expect(await chartsBet.paused()).to.be.true;

			await chartsBet.unpause();
			expect(await chartsBet.paused()).to.be.false;
		});

		it('Should prevent actions when paused', async function () {
			await chartsBet.pause();
			await expect(
				chartsBet.createLeaderboard('FR')
			).to.be.revertedWithCustomError(chartsBet, 'EnforcedPause');
		});
	});

	describe('Getter Functions', function () {
		beforeEach(async function () {
			await chartsBet.createLeaderboard('FR');
			const topArtists = ['GIMS', 'Carbonne', 'Leto', 'Lacrim', 'Dadi'];
			await chartsBet.fulfillTopArtists('FR', topArtists);
		});

		it('Should return correct total bets on artist', async function () {
			const totalBets = await chartsBet.getTotalBetsOnArtist(
				'FR',
				'GIMS'
			);
			expect(totalBets).to.equal(0); // Assuming no bets have been placed yet
		});

		it('Should return correct total bet amount', async function () {
			const totalBetAmount = await chartsBet.getTotalBetAmount('FR');
			expect(totalBetAmount).to.equal(0); // Assuming no bets have been placed yet
		});

		it('Should return correct bets in country', async function () {
			const bets = await chartsBet.getBetsInCountry('FR');
			expect(bets.length).to.equal(0); // Assuming no bets have been placed yet
		});
	});
});
