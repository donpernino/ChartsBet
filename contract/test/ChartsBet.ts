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

		const ChartsOracleFactory = await ethers.getContractFactory(
			'ChartsOracle'
		);
		chartsOracle = await ChartsOracleFactory.deploy();

		const ChartsBetFactory = await ethers.getContractFactory('ChartsBet');
		chartsBet = await ChartsBetFactory.deploy();

		await chartsBet.initialize(
			await owner.getAddress(),
			await chartsOracle.getAddress()
		);
		await chartsOracle.initialize(
			await owner.getAddress(),
			await chartsBet.getAddress()
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
			await expect(
				chartsBet.createLeaderboard(ethers.encodeBytes32String('FR'))
			)
				.to.emit(chartsBet, 'LeaderboardCreated')
				.withArgs(ethers.encodeBytes32String('FR'));
		});

		it('Should revert if non-owner tries to create a leaderboard', async function () {
			await expect(
				chartsBet
					.connect(addr1)
					.createLeaderboard(ethers.encodeBytes32String('FR'))
			).to.be.revertedWithCustomError(
				chartsBet,
				'OwnableUnauthorizedAccount'
			);
		});

		it('Should revert if an invalid country code is provided', async function () {
			await expect(
				chartsBet.createLeaderboard(ethers.encodeBytes32String('XX'))
			).to.be.revertedWithCustomError(chartsBet, 'InvalidCountryCode');
		});
	});

	describe('Fulfilling Top Artists', function () {
		beforeEach(async function () {
			await chartsBet.createLeaderboard(ethers.encodeBytes32String('FR'));
		});

		it('Should allow the oracle to fulfill top artists', async function () {
			const topArtists = ['GIMS', 'Carbonne', 'Leto', 'Lacrim', 'Dadi'];
			const tx = await chartsOracle.requestLeaderboardData(
				ethers.encodeBytes32String('FR')
			);
			const receipt = (await tx.wait()) as any;
			const requestId = receipt.logs[0].topics[1];

			await expect(
				chartsOracle.fulfillLeaderboardData(
					requestId,
					ethers.encodeBytes32String('FR'),
					topArtists
				)
			)
				.to.emit(chartsBet, 'TopArtistsFulfilled')
				.withArgs(ethers.encodeBytes32String('FR'));

			for (const artist of topArtists) {
				const odds = await chartsBet.getArtistOdds(
					ethers.encodeBytes32String('FR'),
					artist
				);
				expect(odds).to.be.gt(0);
			}
		});

		it('Should revert if non-oracle tries to fulfill top artists', async function () {
			const topArtists = ['GIMS', 'Carbonne', 'Leto', 'Lacrim', 'Dadi'];
			await expect(
				chartsBet.fulfillTopArtists(
					ethers.encodeBytes32String('FR'),
					topArtists
				)
			).to.be.revertedWithCustomError(chartsBet, 'OnlyOracleAllowed');
		});
	});

	describe('Fulfilling Daily Winner', function () {
		beforeEach(async function () {
			await chartsBet.createLeaderboard(ethers.encodeBytes32String('FR'));
			const topArtists = ['GIMS', 'Carbonne', 'Leto', 'Lacrim', 'Dadi'];
			const tx = await chartsOracle.requestLeaderboardData(
				ethers.encodeBytes32String('FR')
			);
			const receipt = (await tx.wait()) as any;
			const requestId = receipt.logs[0].topics[1];
			await chartsOracle.fulfillLeaderboardData(
				requestId,
				ethers.encodeBytes32String('FR'),
				topArtists
			);
		});

		it('Should allow the oracle to fulfill daily winner', async function () {
			const tx = await chartsOracle.requestDailyWinner(
				ethers.encodeBytes32String('FR')
			);
			const receipt = (await tx.wait()) as any;
			const requestId = receipt.logs[0].topics[1];

			await expect(
				chartsOracle.fulfillDailyWinner(
					requestId,
					ethers.encodeBytes32String('FR'),
					'GIMS'
				)
			)
				.to.emit(chartsBet, 'DailyWinnerFulfilled')
				.withArgs(ethers.encodeBytes32String('FR'), 'GIMS');
		});

		it('Should revert if trying to fulfill daily winner for a closed leaderboard', async function () {
			const tx1 = await chartsOracle.requestDailyWinner(
				ethers.encodeBytes32String('FR')
			);
			const receipt1 = (await tx1.wait()) as any;
			const requestId1 = receipt1.logs[0].topics[1];
			await chartsOracle.fulfillDailyWinner(
				requestId1,
				ethers.encodeBytes32String('FR'),
				'GIMS'
			);

			const tx2 = await chartsOracle.requestDailyWinner(
				ethers.encodeBytes32String('FR')
			);
			const receipt2 = (await tx2.wait()) as any;
			const requestId2 = receipt2.logs[0].topics[1];
			await expect(
				chartsOracle.fulfillDailyWinner(
					requestId2,
					ethers.encodeBytes32String('FR'),
					'Carbonne'
				)
			).to.be.revertedWithCustomError(chartsBet, 'BettingClosed');
		});
	});

	describe('Placing Bets', function () {
		beforeEach(async function () {
			await chartsBet.createLeaderboard(ethers.encodeBytes32String('FR'));
			const topArtists = ['GIMS', 'Carbonne', 'Leto', 'Lacrim', 'Dadi'];
			const tx = await chartsOracle.requestLeaderboardData(
				ethers.encodeBytes32String('FR')
			);
			const receipt = (await tx.wait()) as any;
			const requestId = receipt.logs[0].topics[1];
			await chartsOracle.fulfillLeaderboardData(
				requestId,
				ethers.encodeBytes32String('FR'),
				topArtists
			);
		});

		it('Should allow users to place bets', async function () {
			await expect(
				chartsBet
					.connect(addr1)
					.placeBet(ethers.encodeBytes32String('FR'), 'GIMS', {
						value: ethers.parseEther('0.1'),
					})
			)
				.to.emit(chartsBet, 'BetPlaced')
				.withArgs(
					await addr1.getAddress(),
					ethers.encodeBytes32String('FR'),
					'GIMS',
					ethers.parseEther('0.1')
				);
		});

		it('Should revert if trying to bet on a non-existent artist', async function () {
			await expect(
				chartsBet
					.connect(addr1)
					.placeBet(
						ethers.encodeBytes32String('FR'),
						'NonExistentArtist',
						{ value: ethers.parseEther('0.1') }
					)
			).to.be.revertedWithCustomError(
				chartsBet,
				'ArtistNotInLeaderboard'
			);
		});
	});

	describe('Withdrawals', function () {
		it('Should allow the owner to request a withdrawal', async function () {
			await expect(chartsBet.requestWithdrawal()).to.emit(
				chartsBet,
				'WithdrawalRequested'
			);
		});

		it('Should not allow non-owners to request a withdrawal', async function () {
			await expect(
				chartsBet.connect(addr1).requestWithdrawal()
			).to.be.revertedWithCustomError(
				chartsBet,
				'OwnableUnauthorizedAccount'
			);
		});

		it('Should not allow withdrawal execution before delay', async function () {
			await chartsBet.requestWithdrawal();
			await expect(chartsBet.executeWithdrawal()).to.be.revertedWith(
				'Withdrawal delay not met'
			);
		});
	});

	describe('Pausing and Unpausing', function () {
		it('Should allow the owner to pause and unpause the contract', async function () {
			await chartsBet.toggleContractActive();
			expect(await chartsBet.paused()).to.be.true;

			await chartsBet.toggleContractActive();
			expect(await chartsBet.paused()).to.be.false;
		});

		it('Should prevent actions when paused', async function () {
			await chartsBet.toggleContractActive();
			await expect(
				chartsBet.createLeaderboard(ethers.encodeBytes32String('FR'))
			).to.be.revertedWithCustomError(chartsBet, 'EnforcedPause');
		});
	});

	describe('Getter Functions', function () {
		beforeEach(async function () {
			await chartsBet.createLeaderboard(ethers.encodeBytes32String('FR'));
			const topArtists = ['GIMS', 'Carbonne', 'Leto', 'Lacrim', 'Dadi'];
			const tx = await chartsOracle.requestLeaderboardData(
				ethers.encodeBytes32String('FR')
			);
			const receipt = (await tx.wait()) as any;
			const requestId = receipt.logs[0].topics[1];
			await chartsOracle.fulfillLeaderboardData(
				requestId,
				ethers.encodeBytes32String('FR'),
				topArtists
			);

			for (const artist of topArtists) {
				const odds = await chartsBet.getArtistOdds(
					ethers.encodeBytes32String('FR'),
					artist
				);
			}
		});

		it('Should return correct artist odds', async function () {
			const odds = await chartsBet.getArtistOdds(
				ethers.encodeBytes32String('FR'),
				'GIMS'
			);
			expect(odds).to.be.gt(0);
		});

		it('Should return correct total bets on artist', async function () {
			await chartsBet
				.connect(addr1)
				.placeBet(ethers.encodeBytes32String('FR'), 'GIMS', {
					value: ethers.parseEther('0.1'),
				});
			const totalBets = await chartsBet.getTotalBetsOnArtist(
				ethers.encodeBytes32String('FR'),
				'GIMS'
			);
			expect(totalBets).to.equal(ethers.parseEther('0.1'));
		});

		it('Should return correct total bet amount', async function () {
			await chartsBet
				.connect(addr1)
				.placeBet(ethers.encodeBytes32String('FR'), 'GIMS', {
					value: ethers.parseEther('0.1'),
				});
			await chartsBet
				.connect(addr2)
				.placeBet(ethers.encodeBytes32String('FR'), 'Carbonne', {
					value: ethers.parseEther('0.2'),
				});
			const totalBetAmount = await chartsBet.getTotalBetAmount(
				ethers.encodeBytes32String('FR')
			);
			expect(totalBetAmount).to.equal(ethers.parseEther('0.3'));
		});

		it('Should return correct bets in country', async function () {
			await chartsBet
				.connect(addr1)
				.placeBet(ethers.encodeBytes32String('FR'), 'GIMS', {
					value: ethers.parseEther('0.1'),
				});
			await chartsBet
				.connect(addr2)
				.placeBet(ethers.encodeBytes32String('FR'), 'Carbonne', {
					value: ethers.parseEther('0.2'),
				});
			const bets = await chartsBet.getBetsInCountry(
				ethers.encodeBytes32String('FR')
			);
			expect(bets.length).to.equal(2);
		});
	});
});
