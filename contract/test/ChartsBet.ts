import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ChartsBet, ChartsBetToken } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { time } from '@nomicfoundation/hardhat-network-helpers';

describe('ChartsBet Contract', function () {
	let chartsBet: ChartsBet;
	let chartsBetToken: ChartsBetToken;
	let owner: HardhatEthersSigner;
	let addr1: HardhatEthersSigner;
	let addr2: HardhatEthersSigner;

	const INITIAL_MINT = ethers.parseEther('1000000'); // 1 million tokens
	const MAX_BET = ethers.parseEther('1000'); // 1000 tokens

	beforeEach(async function () {
		[owner, addr1, addr2] = await ethers.getSigners();

		const ChartsBetTokenFactory = await ethers.getContractFactory(
			'ChartsBetToken'
		);
		chartsBetToken = await ChartsBetTokenFactory.deploy(
			await owner.getAddress()
		);
		await chartsBetToken.waitForDeployment();

		const ChartsBetFactory = await ethers.getContractFactory('ChartsBet');
		chartsBet = await ChartsBetFactory.deploy(
			await owner.getAddress(),
			await chartsBetToken.getAddress()
		);
		await chartsBet.waitForDeployment();

		await chartsBet.initialize();

		await chartsBetToken.transfer(await addr1.getAddress(), INITIAL_MINT);
		await chartsBetToken.transfer(await addr2.getAddress(), INITIAL_MINT);

		await chartsBetToken
			.connect(addr1)
			.approve(await chartsBet.getAddress(), ethers.MaxUint256);
		await chartsBetToken
			.connect(addr2)
			.approve(await chartsBet.getAddress(), ethers.MaxUint256);
	});

	describe('Initialization', function () {
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
			const tx = await chartsBet.openAllDailyPools();
			const receipt = await tx.wait();

			const poolOpenedEvents = receipt.logs.filter(
				(log) => log.fragment && log.fragment.name === 'PoolOpened'
			);

			expect(poolOpenedEvents).to.have.lengthOf(8); // 8 countries

			const countries = ['WW', 'BR', 'DE', 'ES', 'FR', 'IT', 'PT', 'US'];
			for (let i = 0; i < countries.length; i++) {
				const event = poolOpenedEvents[i];
				expect(event.args[0]).to.equal(
					ethers.encodeBytes32String(countries[i])
				);
				expect(event.args[1]).to.be.a('bigint'); // day
				expect(event.args[2]).to.be.a('bigint'); // openingTime
				expect(event.args[3]).to.be.a('bigint'); // closingTime
				expect(event.args[3]).to.be.greaterThan(event.args[2]); // closingTime > openingTime
			}
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
			const betAmount = ethers.parseEther('100');
			await expect(
				chartsBet
					.connect(addr1)
					.placeBet(
						ethers.encodeBytes32String('WW'),
						ethers.encodeBytes32String('Artist'),
						betAmount
					)
			).to.emit(chartsBet, 'BetPlaced');
		});

		it('Should revert if bet is too high', async function () {
			const betAmount = MAX_BET + 1n;
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

		it('Should revert if pool is not open', async function () {
			await time.increase(86401); // Increase time by more than 1 day
			await expect(
				chartsBet
					.connect(addr1)
					.placeBet(
						ethers.encodeBytes32String('WW'),
						ethers.encodeBytes32String('Artist'),
						ethers.parseEther('100')
					)
			).to.be.revertedWithCustomError(chartsBet, 'PoolNotOpen');
		});

		it('Should revert if bet already placed', async function () {
			await chartsBet
				.connect(addr1)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist'),
					ethers.parseEther('100')
				);
			await expect(
				chartsBet
					.connect(addr1)
					.placeBet(
						ethers.encodeBytes32String('WW'),
						ethers.encodeBytes32String('Artist'),
						ethers.parseEther('100')
					)
			).to.be.revertedWithCustomError(chartsBet, 'BetAlreadyPlaced');
		});
	});

	describe('closePoolAndAnnounceWinner', function () {
		beforeEach(async function () {
			await chartsBet.openAllDailyPools();
		});

		it('Should close pool and announce winner', async function () {
			await time.increase(86400);
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

		it('Should revert if pool is not ready to close', async function () {
			await expect(
				chartsBet.closePoolAndAnnounceWinner(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Winner')
				)
			).to.be.revertedWithCustomError(chartsBet, 'PoolNotReadyToClose');
		});

		it('Should revert if pool is already closed', async function () {
			await time.increase(86400);
			await chartsBet.closePoolAndAnnounceWinner(
				ethers.encodeBytes32String('WW'),
				ethers.encodeBytes32String('Winner')
			);
			await expect(
				chartsBet.closePoolAndAnnounceWinner(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Winner')
				)
			).to.be.revertedWithCustomError(chartsBet, 'PoolAlreadyClosed');
		});
	});

	describe('settleBet and claimPayout', function () {
		beforeEach(async function () {
			await chartsBet.openAllDailyPools();
			await chartsBet.updateTop10(
				ethers.encodeBytes32String('WW'),
				Array(10).fill(ethers.encodeBytes32String('Artist'))
			);

			const betAmount = ethers.parseEther('100');
			await chartsBet
				.connect(addr1)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist'),
					betAmount
				);

			await time.increase(86400);
			await chartsBet.closePoolAndAnnounceWinner(
				ethers.encodeBytes32String('WW'),
				ethers.encodeBytes32String('Artist')
			);
		});

		it('Should settle bet correctly', async function () {
			await expect(
				chartsBet
					.connect(addr1)
					.settleBet(ethers.encodeBytes32String('WW'))
			).to.emit(chartsBet, 'BetSettled');
		});

		it('Should allow claiming payout', async function () {
			const betAmount = ethers.parseEther('100');

			// Transfer additional tokens to the contract to cover potential payouts
			await chartsBetToken.transfer(
				await chartsBet.getAddress(),
				betAmount * 2n
			);

			await chartsBet
				.connect(addr1)
				.settleBet(ethers.encodeBytes32String('WW'));

			const initialBalance = await chartsBetToken.balanceOf(
				addr1.address
			);

			await expect(chartsBet.connect(addr1).claimPayout()).to.emit(
				chartsBet,
				'PayoutClaimed'
			);

			const finalBalance = await chartsBetToken.balanceOf(addr1.address);
			expect(finalBalance).to.be.greaterThan(initialBalance);

			// Check that the payout is not more than the bet amount plus the reserve
			const maxPayout =
				betAmount + (betAmount * BigInt(50)) / BigInt(100); // 50% reserve
			expect(finalBalance - initialBalance).to.be.at.most(maxPayout);
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

	describe('ChartsBet Reserve System', function () {
		let chartsBet: ChartsBet;
		let chartsBetToken: ChartsBetToken;
		let owner: HardhatEthersSigner;
		let alice: HardhatEthersSigner;
		let bob: HardhatEthersSigner;

		const INITIAL_BALANCE = ethers.parseEther('1000');
		const BET_AMOUNT = ethers.parseEther('100');

		beforeEach(async function () {
			[owner, alice, bob] = await ethers.getSigners();

			const ChartsBetTokenFactory = await ethers.getContractFactory(
				'ChartsBetToken'
			);
			chartsBetToken = await ChartsBetTokenFactory.deploy(
				await owner.getAddress()
			);
			await chartsBetToken.waitForDeployment();

			const ChartsBetFactory = await ethers.getContractFactory(
				'ChartsBet'
			);
			chartsBet = await ChartsBetFactory.deploy(
				await owner.getAddress(),
				await chartsBetToken.getAddress()
			);
			await chartsBet.waitForDeployment();

			await chartsBet.initialize();

			// Give Alice and Bob some tokens
			await chartsBetToken.transfer(alice.address, INITIAL_BALANCE);
			await chartsBetToken.transfer(bob.address, INITIAL_BALANCE);

			// Approve ChartsBet to spend tokens
			await chartsBetToken
				.connect(alice)
				.approve(await chartsBet.getAddress(), ethers.MaxUint256);
			await chartsBetToken
				.connect(bob)
				.approve(await chartsBet.getAddress(), ethers.MaxUint256);

			// Open pools and set top artists
			await chartsBet.openAllDailyPools();
			await chartsBet.updateTop10(
				ethers.encodeBytes32String('WW'),
				Array(10)
					.fill(0)
					.map((_, i) => ethers.encodeBytes32String(`Artist${i}`))
			);
		});

		it('should handle bets and payouts correctly with reserve system', async function () {
			// Place bets
			await chartsBet
				.connect(alice)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist0'),
					BET_AMOUNT
				);
			await chartsBet
				.connect(bob)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist1'),
					BET_AMOUNT
				);

			// Close pool
			await time.increase(86400);
			await chartsBet.closePoolAndAnnounceWinner(
				ethers.encodeBytes32String('WW'),
				ethers.encodeBytes32String('Artist0')
			);

			// Settle bets
			await chartsBet
				.connect(alice)
				.settleBet(ethers.encodeBytes32String('WW'));
			await chartsBet
				.connect(bob)
				.settleBet(ethers.encodeBytes32String('WW'));

			// Claim payouts
			const aliceInitialBalance = await chartsBetToken.balanceOf(
				alice.address
			);
			await chartsBet.connect(alice).claimPayout();
			const aliceFinalBalance = await chartsBetToken.balanceOf(
				alice.address
			);

			const bobInitialBalance = await chartsBetToken.balanceOf(
				bob.address
			);
			await expect(
				chartsBet.connect(bob).claimPayout()
			).to.be.revertedWithCustomError(chartsBet, 'NoPayoutToClaim');
			const bobFinalBalance = await chartsBetToken.balanceOf(bob.address);

			// Check balances
			expect(aliceFinalBalance).to.be.gt(aliceInitialBalance);
			expect(bobFinalBalance).to.equal(bobInitialBalance); // Bob should not receive any payout

			// Check that Alice's payout is not more than bet amount plus reserve
			const maxPayout =
				BET_AMOUNT + (BET_AMOUNT * BigInt(50)) / BigInt(100); // 50% reserve
			expect(aliceFinalBalance - aliceInitialBalance).to.be.at.most(
				maxPayout
			);

			// Check contract balance
			const contractBalance = await chartsBetToken.balanceOf(
				await chartsBet.getAddress()
			);
			expect(contractBalance).to.be.gt(0); // Contract should have some reserve left
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
			const withdrawAmount = ethers.parseEther('100');
			await chartsBetToken.transfer(
				await chartsBet.getAddress(),
				withdrawAmount
			);

			const initialBalance = await chartsBetToken.balanceOf(
				owner.address
			);
			await chartsBet.withdrawTokens(withdrawAmount);
			const finalBalance = await chartsBetToken.balanceOf(owner.address);

			expect(finalBalance).to.equal(initialBalance + withdrawAmount);
		});

		it('Should revert if non-owner tries to withdraw tokens', async function () {
			await expect(
				chartsBet
					.connect(addr1)
					.withdrawTokens(ethers.parseEther('100'))
			).to.be.revertedWithCustomError(
				chartsBet,
				'OwnableUnauthorizedAccount'
			);
		});
	});

	describe('Additional ChartsBet Tests', function () {
		it('Should revert when placing bet for invalid country', async function () {
			await chartsBet.openAllDailyPools();
			await expect(
				chartsBet
					.connect(addr1)
					.placeBet(
						ethers.encodeBytes32String('INVALID'),
						ethers.encodeBytes32String('Artist'),
						ethers.parseEther('100')
					)
			).to.be.revertedWithCustomError(chartsBet, 'InvalidCountry');
		});

		it('Should not allow bets when contract is paused', async function () {
			await chartsBet.openAllDailyPools();
			await chartsBet.pause();
			await expect(
				chartsBet
					.connect(addr1)
					.placeBet(
						ethers.encodeBytes32String('WW'),
						ethers.encodeBytes32String('Artist'),
						ethers.parseEther('100')
					)
			).to.be.revertedWithCustomError(chartsBet, 'EnforcedPause');
			await chartsBet.unpause();
		});

		it('Should handle multiple bets and payouts correctly', async function () {
			await chartsBet.openAllDailyPools();
			await chartsBet.updateTop10(
				ethers.encodeBytes32String('WW'),
				Array(10)
					.fill(0)
					.map((_, i) => ethers.encodeBytes32String(`Artist${i}`))
			);

			// Approve ChartsBet to spend tokens for all bettors
			await chartsBetToken
				.connect(owner)
				.approve(await chartsBet.getAddress(), ethers.MaxUint256);

			// Place multiple bets
			await chartsBet
				.connect(addr1)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist0'),
					ethers.parseEther('100')
				);
			await chartsBet
				.connect(addr2)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist1'),
					ethers.parseEther('100')
				);
			await chartsBet
				.connect(owner)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist0'),
					ethers.parseEther('100')
				);

			await time.increase(86400);
			await chartsBet.closePoolAndAnnounceWinner(
				ethers.encodeBytes32String('WW'),
				ethers.encodeBytes32String('Artist0')
			);

			// Settle and claim for all bettors
			for (const bettor of [addr1, addr2, owner]) {
				await chartsBet
					.connect(bettor)
					.settleBet(ethers.encodeBytes32String('WW'));

				const initialBalance = await chartsBetToken.balanceOf(
					bettor.address
				);

				try {
					await chartsBet.connect(bettor).claimPayout();
				} catch (error: any) {
					// If there's no payout to claim, the transaction will revert
					expect(error.message).to.include('NoPayoutToClaim');
				}

				const finalBalance = await chartsBetToken.balanceOf(
					bettor.address
				);

				if (bettor === addr2) {
					// addr2 bet on the losing artist, so their balance should not change
					expect(finalBalance).to.equal(initialBalance);
				} else {
					// addr1 and owner bet on the winning artist, so their balance should increase
					expect(finalBalance).to.be.gt(initialBalance);
				}
			}

			// Check final balances
			const addr1FinalBalance = await chartsBetToken.balanceOf(
				addr1.address
			);
			const addr2FinalBalance = await chartsBetToken.balanceOf(
				addr2.address
			);
			const ownerFinalBalance = await chartsBetToken.balanceOf(
				owner.address
			);

			expect(addr1FinalBalance).to.be.gt(INITIAL_MINT);
			expect(addr2FinalBalance).to.be.lt(INITIAL_MINT);
			expect(ownerFinalBalance).to.be.gt(INITIAL_MINT);

			// Check contract balance
			const contractBalance = await chartsBetToken.balanceOf(
				await chartsBet.getAddress()
			);
			expect(contractBalance).to.be.gt(0); // Contract should have some reserve left
		});

		it('Should handle updateTop10 with duplicate artists', async function () {
			const artists = Array(10).fill(
				ethers.encodeBytes32String('Artist')
			);
			await expect(
				chartsBet.updateTop10(ethers.encodeBytes32String('WW'), artists)
			).to.not.be.reverted;

			// Check that the first artist is set correctly
			const firstArtist = await chartsBet.top10Artists(
				ethers.encodeBytes32String('WW'),
				0
			);
			expect(firstArtist).to.equal(ethers.encodeBytes32String('Artist'));
		});
	});
});
