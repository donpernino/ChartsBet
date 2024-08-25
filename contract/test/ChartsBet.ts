import {
	time,
	loadFixture,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract, Signer } from 'ethers';

describe('ChartsBet with Oracle Integration', function () {
	let chartsBet: Contract;
	let owner: Signer;
	let otherAccount: Signer;

	// Fixture to deploy the ChartsBet contract along with the Oracle contract
	async function deployChartsBetFixture() {
		[owner, otherAccount] = await ethers.getSigners();

		// Deploy ChartsBet which will internally deploy Oracle
		const ChartsBet = await ethers.getContractFactory('ChartsBet');
		chartsBet = await ChartsBet.deploy();

		const oracle = await chartsBet.oracle();

		return { chartsBet, oracle, owner, otherAccount };
	}

	// Mocking the Oracle fulfillment by directly calling fulfill functions
	async function fulfillOracleLeaderboard(
		chartsBet: Contract,
		requestId: string,
		topArtists: string[]
	) {
		await chartsBet.fulfillTopArtists(requestId, topArtists);
	}

	async function fulfillOracleDailyWinner(
		chartsBet: Contract,
		requestId: string,
		winningArtist: string
	) {
		await chartsBet.fulfillDailyWinner(requestId, winningArtist);
	}

	describe('Deployment', function () {
		it('Should set the correct owner and oracle contract', async function () {
			const { chartsBet, owner } = await loadFixture(
				deployChartsBetFixture
			);

			expect(await chartsBet.owner()).to.equal(await owner.getAddress());
			const oracleAddress = await chartsBet.oracle();
			expect(oracleAddress).to.properAddress;
		});
	});

	describe('Creating Leaderboards', function () {
		it('Should allow the owner to create a new leaderboard and assign ranks and odds', async function () {
			const { chartsBet } = await loadFixture(deployChartsBetFixture);

			await chartsBet.createLeaderboard('FR');

			// Mock the Oracle to fulfill leaderboard data
			const topArtists = [
				'GIMS',
				'GIMS',
				'Carbonne',
				'Leto',
				'Lacrim',
				'Dadi',
				'FloyyMenor',
				'Ninho',
				'Gambi',
				'THEODORT',
			];
			const requestId = ethers.keccak256(
				ethers.toUtf8Bytes('requestId1')
			);
			await fulfillOracleLeaderboard(chartsBet, requestId, topArtists);

			const leaderboard = await chartsBet.leaderboards('FR');
			expect(leaderboard.country).to.equal('FR');
			expect(
				leaderboard.artistRank[
					ethers.keccak256(ethers.toUtf8Bytes('GIMS'))
				]
			).to.equal(1); // Effective rank
			expect(
				leaderboard.artistOdds[
					ethers.keccak256(ethers.toUtf8Bytes('GIMS'))
				]
			).to.be.closeTo(130, 5); // Odds based on effective rank
		});

		it('Should revert if leaderboard already exists', async function () {
			const { chartsBet } = await loadFixture(deployChartsBetFixture);

			await chartsBet.createLeaderboard('FR');
			await expect(
				chartsBet.createLeaderboard('FR')
			).to.be.revertedWithCustomError(chartsBet, 'CountryAlreadyExists');
		});
	});

	describe('Placing Bets', function () {
		it('Should allow users to place a bet with correct odds calculation (case-insensitive)', async function () {
			const { chartsBet, otherAccount } = await loadFixture(
				deployChartsBetFixture
			);

			await chartsBet.createLeaderboard('FR');

			// Mock the Oracle to fulfill leaderboard data
			const topArtists = [
				'GIMS',
				'GIMS',
				'Carbonne',
				'Leto',
				'Lacrim',
				'Dadi',
				'FloyyMenor',
				'Ninho',
				'Gambi',
				'THEODORT',
			];
			const requestId = ethers.keccak256(
				ethers.toUtf8Bytes('requestId1')
			);
			await fulfillOracleLeaderboard(chartsBet, requestId, topArtists);

			await chartsBet.connect(otherAccount).placeBet('FR', 'gims', {
				value: ethers.parseEther('1'),
			});

			const leaderboard = await chartsBet.leaderboards('FR');
			const artistHash = ethers.keccak256(ethers.toUtf8Bytes('gims'));

			expect(leaderboard.totalBetAmount).to.equal(ethers.parseEther('1'));
			expect(leaderboard.totalBetsOnArtist[artistHash]).to.equal(
				ethers.parseEther('1')
			);
		});

		it('Should revert if bet amount is zero', async function () {
			const { chartsBet, otherAccount } = await loadFixture(
				deployChartsBetFixture
			);

			await chartsBet.createLeaderboard('FR');

			// Mock the Oracle to fulfill leaderboard data
			const topArtists = [
				'GIMS',
				'GIMS',
				'Carbonne',
				'Leto',
				'Lacrim',
				'Dadi',
				'FloyyMenor',
				'Ninho',
				'Gambi',
				'THEODORT',
			];
			const requestId = ethers.keccak256(
				ethers.toUtf8Bytes('requestId1')
			);
			await fulfillOracleLeaderboard(chartsBet, requestId, topArtists);

			await expect(
				chartsBet
					.connect(otherAccount)
					.placeBet('FR', 'gims', { value: 0 })
			).to.be.revertedWithCustomError(chartsBet, 'BetAmountZero');
		});

		it('Should revert if betting is closed for the country', async function () {
			const { chartsBet, otherAccount } = await loadFixture(
				deployChartsBetFixture
			);

			await chartsBet.createLeaderboard('FR');
			await chartsBet.requestWinningArtist('FR'); // Manually close betting

			await expect(
				chartsBet.connect(otherAccount).placeBet('FR', 'gims', {
					value: ethers.parseEther('1'),
				})
			).to.be.revertedWithCustomError(chartsBet, 'BettingClosed');
		});

		it('Should handle case-insensitive artist names correctly', async function () {
			const { chartsBet, otherAccount } = await loadFixture(
				deployChartsBetFixture
			);

			await chartsBet.createLeaderboard('FR');

			// Mock the Oracle to fulfill leaderboard data
			const topArtists = [
				'GIMS',
				'gims',
				'Carbonne',
				'Leto',
				'Lacrim',
				'Dadi',
				'FloyyMenor',
				'Ninho',
				'Gambi',
				'THEODORT',
			];
			const requestId = ethers.keccak256(
				ethers.toUtf8Bytes('requestId1')
			);
			await fulfillOracleLeaderboard(chartsBet, requestId, topArtists);

			await chartsBet.connect(otherAccount).placeBet('FR', 'GIMS', {
				value: ethers.parseEther('1'),
			});

			const leaderboard = await chartsBet.leaderboards('FR');
			const artistHash = ethers.keccak256(ethers.toUtf8Bytes('gims'));

			expect(leaderboard.totalBetAmount).to.equal(ethers.parseEther('1'));
			expect(leaderboard.totalBetsOnArtist[artistHash]).to.equal(
				ethers.parseEther('1')
			);
		});
	});

	describe('Requesting Winning Artist', function () {
		it('Should allow the owner to request the winning artist after the betting period', async function () {
			const { chartsBet } = await loadFixture(deployChartsBetFixture);

			await chartsBet.createLeaderboard('FR');
			await time.increase(7 * 24 * 60 * 60 + 1); // Increase time to simulate betting period ended

			await expect(chartsBet.requestWinningArtist('FR')).not.to.be
				.reverted;
		});

		it('Should revert if requested before the betting period ends', async function () {
			const { chartsBet } = await loadFixture(deployChartsBetFixture);

			await chartsBet.createLeaderboard('FR');

			await expect(
				chartsBet.requestWinningArtist('FR')
			).to.be.revertedWithCustomError(
				chartsBet,
				'BettingPeriodNotEndedYet'
			);
		});

		it('Should emit an event when the winning artist is requested', async function () {
			const { chartsBet } = await loadFixture(deployChartsBetFixture);

			await chartsBet.createLeaderboard('FR');
			await time.increase(7 * 24 * 60 * 60 + 1); // Increase time to simulate betting period ended

			await expect(chartsBet.requestWinningArtist('FR'))
				.to.emit(chartsBet, 'RequestWinningArtist')
				.withArgs(anyValue, anyValue); // We accept any value for requestId and winningArtist
		});
	});

	describe('Oracle Fulfillment', function () {
		it('Should fulfill leaderboard data correctly via the Oracle', async function () {
			const { chartsBet } = await loadFixture(deployChartsBetFixture);

			await chartsBet.createLeaderboard('FR');

			const topArtists = [
				'GIMS',
				'GIMS',
				'Carbonne',
				'Leto',
				'Lacrim',
				'Dadi',
				'FloyyMenor',
				'Ninho',
				'Gambi',
				'THEODORT',
			];
			const requestId = ethers.keccak256(
				ethers.toUtf8Bytes('requestId1')
			);

			// Simulate the Oracle fulfilling the request
			await fulfillOracleLeaderboard(chartsBet, requestId, topArtists);

			const leaderboard = await chartsBet.leaderboards('FR');
			expect(leaderboard.country).to.equal('FR');
			expect(
				leaderboard.artistRank[
					ethers.keccak256(ethers.toUtf8Bytes('GIMS'))
				]
			).to.equal(1);
		});

		it('Should fulfill daily winner data correctly via the Oracle', async function () {
			const { chartsBet } = await loadFixture(deployChartsBetFixture);

			await chartsBet.createLeaderboard('FR');
			await time.increase(7 * 24 * 60 * 60 + 1); // Increase time to simulate betting period ended

			const requestId = ethers.keccak256(
				ethers.toUtf8Bytes('requestId2')
			);

			// Simulate the Oracle fulfilling the request for the daily winner
			await fulfillOracleDailyWinner(chartsBet, requestId, 'GIMS');

			const leaderboard = await chartsBet.leaderboards('FR');
			expect(leaderboard.winningArtist).to.equal('GIMS');
		});
	});

	describe('Emergency Withdrawals', function () {
		it('Should allow the owner to withdraw funds in case of emergency', async function () {
			const { chartsBet, owner, otherAccount } = await loadFixture(
				deployChartsBetFixture
			);

			await chartsBet.createLeaderboard('FR');

			// Mock the Oracle to fulfill leaderboard data
			const topArtists = [
				'GIMS',
				'GIMS',
				'Carbonne',
				'Leto',
				'Lacrim',
				'Dadi',
				'FloyyMenor',
				'Ninho',
				'Gambi',
				'THEODORT',
			];
			const requestId = ethers.keccak256(
				ethers.toUtf8Bytes('requestId1')
			);
			await fulfillOracleLeaderboard(chartsBet, requestId, topArtists);

			await chartsBet.connect(otherAccount).placeBet('FR', 'GIMS', {
				value: ethers.parseEther('1'),
			});

			const initialOwnerBalance = await ethers.provider.getBalance(
				await owner.getAddress()
			);
			await chartsBet.emergencyWithdraw();
			const finalOwnerBalance = await ethers.provider.getBalance(
				await owner.getAddress()
			);

			expect(finalOwnerBalance).to.be.gt(initialOwnerBalance);
		});

		it('Should revert if non-owner attempts to withdraw funds', async function () {
			const { chartsBet, otherAccount } = await loadFixture(
				deployChartsBetFixture
			);

			await expect(
				chartsBet.connect(otherAccount).emergencyWithdraw()
			).to.be.revertedWithCustomError(chartsBet, 'Unauthorized');
		});
	});
});
