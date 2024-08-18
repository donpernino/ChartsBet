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

	describe('Creating Genres', function () {
		it('Should allow the owner to create a new genre', async function () {
			const { chartsBet, owner } = await loadFixture(
				deployChartsBetFixture
			);

			await chartsBet.createGenre('Pop', 86400); // 1 day duration

			const genre = await chartsBet.genres('Pop');
			expect(genre.name).to.equal('Pop');
			expect(genre.duration).to.equal(86400);
		});

		it('Should revert if genre name is empty', async function () {
			const { chartsBet } = await loadFixture(deployChartsBetFixture);

			await expect(
				chartsBet.createGenre('', 86400)
			).to.be.revertedWithCustomError(chartsBet, 'GenreNameEmpty');
		});

		it('Should revert if genre already exists', async function () {
			const { chartsBet } = await loadFixture(deployChartsBetFixture);

			await chartsBet.createGenre('Pop', 86400);

			await expect(
				chartsBet.createGenre('Pop', 86400)
			).to.be.revertedWithCustomError(chartsBet, 'GenreAlreadyExists');
		});
	});

	describe('Placing Bets', function () {
		it('Should allow users to place a bet', async function () {
			const { chartsBet, otherAccount } = await loadFixture(
				deployChartsBetFixture
			);

			await chartsBet.createGenre('Pop', 86400);

			await chartsBet.connect(otherAccount).placeBet('Pop', 'Artist A', {
				value: hre.ethers.parseEther('1'),
			});

			const genre = await chartsBet.genres('Pop');
			expect(genre.totalBetAmount).to.equal(hre.ethers.parseEther('1'));
		});

		it('Should revert if bet amount is zero', async function () {
			const { chartsBet, otherAccount } = await loadFixture(
				deployChartsBetFixture
			);

			await chartsBet.createGenre('Pop', 86400);

			await expect(
				chartsBet
					.connect(otherAccount)
					.placeBet('Pop', 'Artist A', { value: 0 })
			).to.be.revertedWithCustomError(chartsBet, 'BetAmountZero');
		});

		it('Should revert if betting is closed for the genre', async function () {
			const { chartsBet, otherAccount } = await loadFixture(
				deployChartsBetFixture
			);

			await chartsBet.createGenre('Pop', 86400);
			await time.increase(86401); // Increase time to simulate betting period ended

			await expect(
				chartsBet.connect(otherAccount).placeBet('Pop', 'Artist A', {
					value: hre.ethers.parseEther('1'),
				})
			).to.be.revertedWithCustomError(chartsBet, 'BettingPeriodEnded');
		});

		it('Should revert if betting is closed manually', async function () {
			const { chartsBet, otherAccount } = await loadFixture(
				deployChartsBetFixture
			);

			await chartsBet.createGenre('Pop', 86400);
			await chartsBet.requestWinningArtist('Pop'); // Manually close betting

			await expect(
				chartsBet.connect(otherAccount).placeBet('Pop', 'Artist A', {
					value: hre.ethers.parseEther('1'),
				})
			).to.be.revertedWithCustomError(chartsBet, 'BettingClosed');
		});
	});

	describe('Requesting Winning Artist', function () {
		it('Should allow the owner to request the winning artist after the betting period', async function () {
			const { chartsBet } = await loadFixture(deployChartsBetFixture);

			await chartsBet.createGenre('Pop', 86400);
			await time.increase(86401); // Increase time to simulate betting period ended

			await expect(chartsBet.requestWinningArtist('Pop')).not.to.be
				.reverted;
		});

		it('Should revert if requested before the betting period ends', async function () {
			const { chartsBet } = await loadFixture(deployChartsBetFixture);

			await chartsBet.createGenre('Pop', 86400);

			await expect(
				chartsBet.requestWinningArtist('Pop')
			).to.be.revertedWithCustomError(
				chartsBet,
				'BettingPeriodNotEndedYet'
			);
		});

		it('Should emit an event when the winning artist is requested', async function () {
			const { chartsBet } = await loadFixture(deployChartsBetFixture);

			await chartsBet.createGenre('Pop', 86400);
			await time.increase(86401); // Increase time to simulate betting period ended

			await expect(chartsBet.requestWinningArtist('Pop'))
				.to.emit(chartsBet, 'RequestWinningArtist')
				.withArgs(anyValue, anyValue); // We accept any value for requestId and winningArtist
		});
	});

	describe('Emergency Withdrawals', function () {
		it('Should allow the owner to withdraw funds in case of emergency', async function () {
			const { chartsBet, owner, otherAccount } = await loadFixture(
				deployChartsBetFixture
			);

			await chartsBet.createGenre('Pop', 86400);
			await chartsBet.connect(otherAccount).placeBet('Pop', 'Artist A', {
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
