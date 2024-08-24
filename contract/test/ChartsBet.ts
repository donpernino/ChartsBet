import {
	time,
	loadFixture,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { expect } from 'chai';
import hre from 'hardhat';

describe('ChartsBet', function () {
	// Fixture to deploy the ChartsBet contract
	async function deployChartsBetFixture() {
		const [owner, otherAccount] = await hre.ethers.getSigners();

		const ChartsBet = await hre.ethers.getContractFactory('ChartsBet');
		const chartsBet = await ChartsBet.deploy();

		const oracle = '0x7AFe1118Ea78C1eae84ca8feE5C68b64E7aC08dF'; // Example Oracle Address
		const jobId = 'd5270d1c311941d0b08bead21fea7747'; // Example Job ID
		const fee = hre.ethers.parseUnits('0.1', 'ether'); // Example Fee for Chainlink

		return { chartsBet, oracle, jobId, fee, owner, otherAccount };
	}

	// Mocking the Chainlink Oracle fulfillment
	async function fulfillOracleRequest(chartsBet, requestId, topArtists) {
		await chartsBet.fulfillLeaderboard(requestId, topArtists);
	}

	describe('Deployment', function () {
		it('Should set the correct oracle, jobId, and fee', async function () {
			const { chartsBet, oracle, jobId, fee } = await loadFixture(
				deployChartsBetFixture
			);

			expect(await chartsBet.oracle()).to.equal(oracle);
			expect(await chartsBet.jobId()).to.equal(jobId);
			expect(await chartsBet.fee()).to.equal(fee);
		});

		it('Should set the correct owner', async function () {
			const { chartsBet, owner } = await loadFixture(
				deployChartsBetFixture
			);

			expect(await chartsBet.owner()).to.equal(owner.address);
		});
	});

	describe('Creating Leaderboards', function () {
		it('Should allow the owner to create a new leaderboard and assign ranks and odds', async function () {
			const { chartsBet } = await loadFixture(deployChartsBetFixture);

			// Mocking Chainlink Oracle fulfillment
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
			const requestId = hre.ethers.keccak256(
				hre.ethers.toUtf8Bytes('requestId1')
			);
			await fulfillOracleRequest(chartsBet, requestId, topArtists);

			const leaderboard = await chartsBet.leaderboards('FR');
			expect(leaderboard.country).to.equal('FR');
			expect(
				leaderboard.artistRank[
					hre.ethers.keccak256(hre.ethers.toUtf8Bytes('GIMS'))
				]
			).to.equal(1); // Effective rank
			expect(
				leaderboard.artistOdds[
					hre.ethers.keccak256(hre.ethers.toUtf8Bytes('GIMS'))
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

			// Mocking Chainlink Oracle fulfillment
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
			const requestId = hre.ethers.keccak256(
				hre.ethers.toUtf8Bytes('requestId1')
			);
			await fulfillOracleRequest(chartsBet, requestId, topArtists);

			await chartsBet.connect(otherAccount).placeBet('FR', 'gims', {
				value: hre.ethers.parseEther('1'),
			});

			const leaderboard = await chartsBet.leaderboards('FR');
			const artistHash = hre.ethers.keccak256(
				hre.ethers.toUtf8Bytes('gims')
			);

			expect(leaderboard.totalBetAmount).to.equal(
				hre.ethers.parseEther('1')
			);
			expect(leaderboard.totalBetsOnArtist[artistHash]).to.equal(
				hre.ethers.parseEther('1')
			);
		});

		it('Should revert if bet amount is zero', async function () {
			const { chartsBet, otherAccount } = await loadFixture(
				deployChartsBetFixture
			);

			// Mocking Chainlink Oracle fulfillment
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
			const requestId = hre.ethers.keccak256(
				hre.ethers.toUtf8Bytes('requestId1')
			);
			await fulfillOracleRequest(chartsBet, requestId, topArtists);

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
					value: hre.ethers.parseEther('1'),
				})
			).to.be.revertedWithCustomError(chartsBet, 'BettingClosed');
		});

		it('Should handle case-insensitive artist names correctly', async function () {
			const { chartsBet, otherAccount } = await loadFixture(
				deployChartsBetFixture
			);

			// Mocking Chainlink Oracle fulfillment
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
			const requestId = hre.ethers.keccak256(
				hre.ethers.toUtf8Bytes('requestId1')
			);
			await fulfillOracleRequest(chartsBet, requestId, topArtists);

			await chartsBet.connect(otherAccount).placeBet('FR', 'GIMS', {
				value: hre.ethers.parseEther('1'),
			});

			const leaderboard = await chartsBet.leaderboards('FR');
			const artistHash = hre.ethers.keccak256(
				hre.ethers.toUtf8Bytes('gims')
			);

			expect(leaderboard.totalBetAmount).to.equal(
				hre.ethers.parseEther('1')
			);
			expect(leaderboard.totalBetsOnArtist[artistHash]).to.equal(
				hre.ethers.parseEther('1')
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

	describe('Emergency Withdrawals', function () {
		it('Should allow the owner to withdraw funds in case of emergency', async function () {
			const { chartsBet, owner, otherAccount } = await loadFixture(
				deployChartsBetFixture
			);

			// Mocking Chainlink Oracle fulfillment
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
			const requestId = hre.ethers.keccak256(
				hre.ethers.toUtf8Bytes('requestId1')
			);
			await fulfillOracleRequest(chartsBet, requestId, topArtists);

			await chartsBet.connect(otherAccount).placeBet('FR', 'GIMS', {
				value: hre.ethers.parseEther('1'),
			});

			const initialOwnerBalance = await hre.ethers.provider.getBalance(
				owner.address
			);
			await chartsBet.emergencyWithdraw();
			const finalOwnerBalance = await hre.ethers.provider.getBalance(
				owner.address
			);

			expect(finalOwnerBalance).to.be.gt(initialOwnerBalance);
		});

		it('Should revert if non-owner attempts to withdraw funds', async function () {
			const { chartsBet, otherAccount } = await loadFixture(
				deployChartsBetFixture
			);

			await expect(
				chartsBet.connect(otherAccount).emergencyWithdraw()
			).to.be.revertedWith('Ownable: caller is not the owner');
		});
	});
});
