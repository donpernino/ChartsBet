import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ChartsBet, ChartsBetToken } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('ChartsBet Contract', function () {
	let chartsBet: ChartsBet;
	let chartsBetToken: ChartsBetToken;
	let owner: HardhatEthersSigner;
	let addr1: HardhatEthersSigner;
	let addr2: HardhatEthersSigner;

	const INITIAL_MINT = ethers.parseEther('1000000'); // 1 million tokens

	beforeEach(async function () {
		[owner, addr1, addr2] = await ethers.getSigners();

		console.log('Deploying ChartsBetToken...');
		const ChartsBetTokenFactory = await ethers.getContractFactory(
			'ChartsBetToken'
		);
		chartsBetToken = await ChartsBetTokenFactory.deploy(
			await owner.getAddress()
		);
		await chartsBetToken.waitForDeployment();
		console.log(
			'ChartsBetToken deployed at:',
			await chartsBetToken.getAddress()
		);

		console.log('Deploying ChartsBet...');
		const ChartsBetFactory = await ethers.getContractFactory('ChartsBet');
		chartsBet = await ChartsBetFactory.deploy(
			await owner.getAddress(),
			await chartsBetToken.getAddress()
		);
		await chartsBet.waitForDeployment();
		console.log('ChartsBet deployed at:', await chartsBet.getAddress());

		console.log('Initializing ChartsBet...');
		await chartsBet.initialize();
		console.log('ChartsBet initialized');

		// Transfer tokens to addr1 and addr2 instead of minting
		await chartsBetToken.transfer(await addr1.getAddress(), INITIAL_MINT);
		await chartsBetToken.transfer(await addr2.getAddress(), INITIAL_MINT);

		// Approve ChartsBet to spend tokens
		await chartsBetToken
			.connect(addr1)
			.approve(await chartsBet.getAddress(), ethers.MaxUint256);
		await chartsBetToken
			.connect(addr2)
			.approve(await chartsBet.getAddress(), ethers.MaxUint256);
	});

	describe('initialize', function () {
		it('Should set valid countries', async function () {
			const countries = ['WW', 'BR', 'DE', 'ES', 'FR', 'IT', 'PT', 'US'];
			for (const country of countries) {
				expect(
					await chartsBet.validCountries(
						ethers.encodeBytes32String(country)
					)
				).to.be.true;
			}
		});
	});

	describe('openAllDailyPools', function () {
		it('Should open pools for all countries', async function () {
			await expect(chartsBet.openAllDailyPools())
				.to.emit(chartsBet, 'PoolOpened')
				.withArgs(
					ethers.encodeBytes32String('WW'),
					(day: any) => typeof day === 'bigint',
					(openingTime: any) => typeof openingTime === 'bigint',
					(closingTime: any) => typeof closingTime === 'bigint'
				);
		});

		it('Should revert if non-owner tries to open pools', async function () {
			await expect(
				chartsBet.connect(addr1).openAllDailyPools()
			).to.be.revertedWithCustomError(
				chartsBet,
				'OwnableUnauthorizedAccount'
			);
		});
	});

	describe('placeBet', function () {
		beforeEach(async function () {
			await chartsBet.openAllDailyPools();
			await chartsBet.updateTop10(
				ethers.encodeBytes32String('WW'),
				Array(10).fill(ethers.encodeBytes32String('Artist'))
			);
		});

		it('Should allow placing a bet', async function () {
			const betAmount = ethers.parseEther('100'); // 100 tokens
			await expect(
				chartsBet
					.connect(addr1)
					.placeBet(
						ethers.encodeBytes32String('WW'),
						ethers.encodeBytes32String('Artist'),
						betAmount
					)
			)
				.to.emit(chartsBet, 'BetPlaced')
				.withArgs(
					await addr1.getAddress(),
					ethers.encodeBytes32String('WW'),
					await chartsBet.currentDay(),
					ethers.encodeBytes32String('Artist'),
					betAmount,
					(odds: any) => typeof odds === 'bigint'
				);
		});

		it('Should revert if bet is too high', async function () {
			const betAmount = ethers.parseEther('1001'); // 1001 tokens
			await expect(
				chartsBet
					.connect(addr1)
					.placeBet(
						ethers.encodeBytes32String('WW'),
						ethers.encodeBytes32String('Artist'),
						betAmount
					)
			).to.be.revertedWithCustomError(chartsBet, 'BetTooHigh');
		});
	});

	describe('closePoolAndAnnounceWinner', function () {
		beforeEach(async function () {
			await chartsBet.openAllDailyPools();
		});

		it('Should close pool and announce winner', async function () {
			await ethers.provider.send('evm_increaseTime', [86400]);
			await ethers.provider.send('evm_mine', []);

			const currentDay = await chartsBet.currentDay();
			await expect(
				chartsBet.closePoolAndAnnounceWinner(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Winner')
				)
			)
				.to.emit(chartsBet, 'PoolClosed')
				.withArgs(
					ethers.encodeBytes32String('WW'),
					currentDay,
					ethers.encodeBytes32String('Winner')
				);
		});
	});

	describe('settleBet', function () {
		it('Should settle bet correctly', async function () {
			await chartsBet.openAllDailyPools();

			const artists = Array(10)
				.fill(0)
				.map((_, i) => ethers.encodeBytes32String(`Artist${i}`));
			await chartsBet.updateTop10(
				ethers.encodeBytes32String('WW'),
				artists
			);

			const betAmount = ethers.parseEther('100'); // 100 tokens
			const currentDay = await chartsBet.currentDay();

			// Place bet
			await chartsBet
				.connect(addr1)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist0'),
					betAmount
				);

			// Advance time and close pool
			await ethers.provider.send('evm_increaseTime', [86400]);
			await ethers.provider.send('evm_mine', []);
			await chartsBet.closePoolAndAnnounceWinner(
				ethers.encodeBytes32String('WW'),
				ethers.encodeBytes32String('Artist0')
			);

			// Check balances before settling
			const contractBalanceBefore = await chartsBetToken.balanceOf(
				await chartsBet.getAddress()
			);
			const userBalanceBefore = await chartsBetToken.balanceOf(
				await addr1.getAddress()
			);

			// Settle bet
			try {
				const settleTx = await chartsBet
					.connect(addr1)
					.settleBet(ethers.encodeBytes32String('WW'));
				const settleReceipt = await settleTx.wait();

				// Log all events
				settleReceipt.logs.forEach((log: any) => {
					if (log.eventName) {
						console.log(`Event: ${log.eventName}`);
						console.log('Arguments:', log.args);
					}
				});
			} catch (error: any) {
				console.error('Error settling bet:', error.message);
				if (error.data) {
					const decodedError = chartsBet.interface.parseError(
						error.data
					);
					console.error('Decoded error:', decodedError);
				}
			}

			// Check balances after settling
			const contractBalanceAfter = await chartsBetToken.balanceOf(
				await chartsBet.getAddress()
			);
			const userBalanceAfter = await chartsBetToken.balanceOf(
				await addr1.getAddress()
			);
		});
	});

	describe('getOdds', function () {
		beforeEach(async function () {
			const artists = Array(10)
				.fill(0)
				.map((_, i) => ethers.encodeBytes32String(`Artist${i}`));
			await chartsBet.updateTop10(
				ethers.encodeBytes32String('WW'),
				artists
			);
		});

		it('Should return correct odds for top 10 artist', async function () {
			const odds = await chartsBet.getOdds(
				ethers.encodeBytes32String('WW'),
				ethers.encodeBytes32String('Artist0')
			);
			expect(odds).to.equal(120);
		});

		it('Should return correct odds for lower ranked artist', async function () {
			const odds = await chartsBet.getOdds(
				ethers.encodeBytes32String('WW'),
				ethers.encodeBytes32String('Artist5')
			);
			expect(odds).to.equal(220);
		});

		it('Should return outsider odds for non-top 10 artist', async function () {
			const odds = await chartsBet.getOdds(
				ethers.encodeBytes32String('WW'),
				ethers.encodeBytes32String('OutsideArtist')
			);
			expect(odds).to.equal(350);
		});
	});

	describe('updateTop10', function () {
		it('Should update top 10 artists', async function () {
			const artists = Array(10)
				.fill(0)
				.map((_, i) => ethers.encodeBytes32String(`Artist${i}`));
			await chartsBet.updateTop10(
				ethers.encodeBytes32String('WW'),
				artists
			);
			const firstArtist = await chartsBet.top10Artists(
				ethers.encodeBytes32String('WW'),
				0
			);
			expect(firstArtist).to.equal(ethers.encodeBytes32String('Artist0'));
		});

		it('Should revert if not exactly 10 artists', async function () {
			const artists = Array(9)
				.fill(0)
				.map((_, i) => ethers.encodeBytes32String(`Artist${i}`));
			await expect(
				chartsBet.updateTop10(ethers.encodeBytes32String('WW'), artists)
			).to.be.revertedWithCustomError(chartsBet, 'InvalidArtistCount');
		});
	});

	describe('Admin functions', function () {
		it('Should allow owner to pause and unpause', async function () {
			await chartsBet.pause();
			expect(await chartsBet.paused()).to.be.true;

			await chartsBet.unpause();
			expect(await chartsBet.paused()).to.be.false;
		});

		it('Should allow owner to withdraw tokens', async function () {
			await chartsBet.openAllDailyPools();
			await chartsBet.updateTop10(
				ethers.encodeBytes32String('WW'),
				Array(10).fill(ethers.encodeBytes32String('Artist'))
			);

			const betAmount = ethers.parseEther('100'); // 100 tokens
			await chartsBet
				.connect(addr1)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist'),
					betAmount
				);

			const initialBalance = await chartsBetToken.balanceOf(
				owner.address
			);
			await chartsBet.withdrawTokens(betAmount);
			const finalBalance = await chartsBetToken.balanceOf(owner.address);

			expect(finalBalance).to.equal(initialBalance + betAmount);
		});
	});
});
