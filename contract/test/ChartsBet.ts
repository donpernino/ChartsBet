import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ChartsBet } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { time } from '@nomicfoundation/hardhat-network-helpers';

describe('ChartsBet Contract', function () {
	let chartsBet: ChartsBet;
	let owner: HardhatEthersSigner;
	let addr1: HardhatEthersSigner;
	let addr2: HardhatEthersSigner;

	const MAX_BET = ethers.parseEther('1'); // 1 ETH

	beforeEach(async function () {
		[owner, addr1, addr2] = await ethers.getSigners();

		const ChartsBetFactory = await ethers.getContractFactory('ChartsBet');
		chartsBet = await ChartsBetFactory.deploy(await owner.getAddress());
		await chartsBet.waitForDeployment();

		await chartsBet.initialize();
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

			const poolOpenedEvents = receipt?.logs.filter(
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
				ethers.encodeBytes32String('FR'),
				Array(10).fill(ethers.encodeBytes32String('Artist'))
			);
		});

		it('Should allow placing a bet', async function () {
			const betAmount = ethers.parseEther('0.1');

			await expect(
				chartsBet
					.connect(addr1)
					.placeBet(
						ethers.encodeBytes32String('FR'),
						ethers.encodeBytes32String('Artist'),
						{ value: betAmount }
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
						{ value: betAmount }
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
						{ value: ethers.parseEther('0.1') }
					)
			).to.be.revertedWithCustomError(chartsBet, 'PoolNotOpen');
		});

		it('Should revert if bet already placed', async function () {
			await chartsBet
				.connect(addr1)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist'),
					{ value: ethers.parseEther('0.1') }
				);
			await expect(
				chartsBet
					.connect(addr1)
					.placeBet(
						ethers.encodeBytes32String('WW'),
						ethers.encodeBytes32String('Artist'),
						{ value: ethers.parseEther('0.1') }
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

			const betAmount = ethers.parseEther('0.1');
			await chartsBet
				.connect(addr1)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist'),
					{ value: betAmount }
				);

			// Send additional ETH to the contract to cover payouts
			await owner.sendTransaction({
				to: await chartsBet.getAddress(),
				value: ethers.parseEther('1'),
			});

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
			await chartsBet
				.connect(addr1)
				.settleBet(ethers.encodeBytes32String('WW'));

			const initialBalance = await ethers.provider.getBalance(
				addr1.address
			);

			const tx = await chartsBet.connect(addr1).claimPayout();
			const receipt = await tx.wait();
			const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

			const finalBalance = await ethers.provider.getBalance(
				addr1.address
			);

			expect(finalBalance + gasUsed).to.be.gt(initialBalance);

			// Check that the payout is not more than the bet amount plus the reserve
			const betAmount = ethers.parseEther('0.1');
			const maxPayout =
				betAmount + (betAmount * BigInt(50)) / BigInt(100); // 50% reserve
			expect(finalBalance - initialBalance + gasUsed).to.be.at.most(
				maxPayout
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

	describe('ChartsBet Reserve System', function () {
		const BET_AMOUNT = ethers.parseEther('0.1');

		beforeEach(async function () {
			await chartsBet.openAllDailyPools();
			await chartsBet.updateTop10(
				ethers.encodeBytes32String('WW'),
				Array(10)
					.fill(0)
					.map((_, i) => ethers.encodeBytes32String(`Artist${i}`))
			);

			// Send additional ETH to the contract to cover payouts
			await owner.sendTransaction({
				to: await chartsBet.getAddress(),
				value: ethers.parseEther('1'),
			});
		});

		it('should handle bets and payouts correctly with reserve system', async function () {
			// Place bets
			await chartsBet
				.connect(addr1)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist0'),
					{ value: BET_AMOUNT }
				);
			await chartsBet
				.connect(addr2)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist1'),
					{ value: BET_AMOUNT }
				);

			// Close pool
			await time.increase(86400);
			await chartsBet.closePoolAndAnnounceWinner(
				ethers.encodeBytes32String('WW'),
				ethers.encodeBytes32String('Artist0')
			);

			// Settle bets
			await chartsBet
				.connect(addr1)
				.settleBet(ethers.encodeBytes32String('WW'));
			await chartsBet
				.connect(addr2)
				.settleBet(ethers.encodeBytes32String('WW'));

			// Claim payouts
			const aliceInitialBalance = await ethers.provider.getBalance(
				addr1.address
			);
			const aliceClaimTx = await chartsBet.connect(addr1).claimPayout();
			const aliceClaimReceipt = await aliceClaimTx.wait();
			const aliceGasUsed =
				aliceClaimReceipt!.gasUsed * aliceClaimReceipt!.gasPrice;
			const aliceFinalBalance = await ethers.provider.getBalance(
				addr1.address
			);

			const bobInitialBalance = await ethers.provider.getBalance(
				addr2.address
			);
			const bobClaimTx = await chartsBet
				.connect(addr2)
				.claimPayout()
				.catch((e) => e);
			const bobClaimReceipt = await ethers.provider.getTransactionReceipt(
				bobClaimTx.transactionHash
			);
			const bobGasUsed =
				bobClaimReceipt!.gasUsed * bobClaimReceipt!.gasPrice;
			const bobFinalBalance = await ethers.provider.getBalance(
				addr2.address
			);

			// Log balance changes
			console.log(
				'Alice initial balance:',
				aliceInitialBalance.toString()
			);
			console.log('Alice final balance:', aliceFinalBalance.toString());
			console.log('Alice gas used:', aliceGasUsed.toString());
			console.log(
				'Alice balance change:',
				(
					aliceFinalBalance -
					aliceInitialBalance +
					aliceGasUsed
				).toString()
			);

			console.log('Bob initial balance:', bobInitialBalance.toString());
			console.log('Bob final balance:', bobFinalBalance.toString());
			console.log('Bob gas used:', bobGasUsed.toString());
			console.log(
				'Bob balance change:',
				(bobFinalBalance - bobInitialBalance).toString()
			);

			// Check balances
			expect(aliceFinalBalance + aliceGasUsed).to.be.gt(
				aliceInitialBalance,
				"Alice's balance should increase"
			);

			// Check that Alice's payout is not more than bet amount plus reserve
			const maxPayout =
				BET_AMOUNT + (BET_AMOUNT * BigInt(50)) / BigInt(100); // 50% reserve
			const aliceBalanceChange =
				aliceFinalBalance - aliceInitialBalance + aliceGasUsed;
			expect(aliceBalanceChange).to.be.at.most(
				maxPayout,
				"Alice's payout should not exceed max payout"
			);

			// Check Bob's balance change
			const bobBalanceChange = bobFinalBalance - bobInitialBalance;
			expect(bobBalanceChange).to.equal(
				-bobGasUsed,
				"Bob's balance should only decrease by gas costs"
			);

			// Check contract balance
			const contractBalance = await ethers.provider.getBalance(
				await chartsBet.getAddress()
			);
			console.log('Contract balance:', contractBalance.toString());
			expect(contractBalance).to.be.gt(
				0,
				'Contract should have some reserve left'
			);
		});
	});

	describe('Admin functions', function () {
		it('Should allow owner to pause and unpause', async function () {
			await chartsBet.pause();
			expect(await chartsBet.paused()).to.be.true;

			await chartsBet.unpause();
			expect(await chartsBet.paused()).to.be.false;
		});

		it('Should allow owner to withdraw ETH', async function () {
			const withdrawAmount = ethers.parseEther('1');
			await owner.sendTransaction({
				to: await chartsBet.getAddress(),
				value: withdrawAmount,
			});

			const initialBalance = await ethers.provider.getBalance(
				owner.address
			);
			const tx = await chartsBet.withdrawETH(withdrawAmount);
			const receipt = await tx.wait();
			const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

			const finalBalance = await ethers.provider.getBalance(
				owner.address
			);

			expect(finalBalance + gasUsed - initialBalance).to.equal(
				withdrawAmount
			);
		});

		it('Should revert if non-owner tries to withdraw ETH', async function () {
			await expect(
				chartsBet.connect(addr1).withdrawETH(ethers.parseEther('1'))
			).to.be.revertedWithCustomError(
				chartsBet,
				'OwnableUnauthorizedAccount'
			);
		});
	});

	describe('hasBetPlaced', function () {
		beforeEach(async function () {
			await chartsBet.openAllDailyPools();
			await chartsBet.updateTop10(
				ethers.encodeBytes32String('FR'),
				Array(10).fill(ethers.encodeBytes32String('Artist'))
			);
		});

		it('Should return false for address that has not placed a bet', async function () {
			const hasBet = await chartsBet.hasBetPlaced(
				ethers.encodeBytes32String('FR'),
				addr1.address
			);
			expect(hasBet).to.be.false;
		});

		it('Should return true for address that has placed a bet', async function () {
			const betAmount = ethers.parseEther('0.1');
			await chartsBet
				.connect(addr1)
				.placeBet(
					ethers.encodeBytes32String('FR'),
					ethers.encodeBytes32String('Artist'),
					{ value: betAmount }
				);

			const hasBet = await chartsBet.hasBetPlaced(
				ethers.encodeBytes32String('FR'),
				addr1.address
			);
			expect(hasBet).to.be.true;
		});

		it('Should return false for different country even if bet placed', async function () {
			const betAmount = ethers.parseEther('0.1');
			await chartsBet
				.connect(addr1)
				.placeBet(
					ethers.encodeBytes32String('FR'),
					ethers.encodeBytes32String('Artist'),
					{ value: betAmount }
				);

			const hasBet = await chartsBet.hasBetPlaced(
				ethers.encodeBytes32String('WW'),
				addr1.address
			);
			expect(hasBet).to.be.false;
		});

		it('Should return false after pool is closed and bet is settled', async function () {
			const betAmount = ethers.parseEther('0.1');
			await chartsBet
				.connect(addr1)
				.placeBet(
					ethers.encodeBytes32String('FR'),
					ethers.encodeBytes32String('Artist'),
					{ value: betAmount }
				);

			await time.increase(86400); // Advance time by 1 day
			await chartsBet.closePoolAndAnnounceWinner(
				ethers.encodeBytes32String('FR'),
				ethers.encodeBytes32String('Artist')
			);
			await chartsBet
				.connect(addr1)
				.settleBet(ethers.encodeBytes32String('FR'));

			const hasBet = await chartsBet.hasBetPlaced(
				ethers.encodeBytes32String('FR'),
				addr1.address
			);
			expect(hasBet).to.be.false;
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
						{ value: ethers.parseEther('0.1') }
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
						{ value: ethers.parseEther('0.1') }
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

			// Place multiple bets
			await chartsBet
				.connect(addr1)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist0'),
					{ value: ethers.parseEther('0.1') }
				);
			await chartsBet
				.connect(addr2)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist1'),
					{ value: ethers.parseEther('0.1') }
				);
			await chartsBet
				.connect(owner)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist0'),
					{ value: ethers.parseEther('0.1') }
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

				const initialBalance = await ethers.provider.getBalance(
					bettor.address
				);

				try {
					const tx = await chartsBet.connect(bettor).claimPayout();
					const receipt = await tx.wait();
					const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
					const finalBalance = await ethers.provider.getBalance(
						bettor.address
					);

					if (bettor === addr2) {
						// addr2 bet on the losing artist, so their balance should decrease by gas costs
						expect(finalBalance).to.equal(initialBalance - gasUsed);
					} else {
						// addr1 and owner bet on the winning artist, so their balance should increase
						expect(finalBalance + gasUsed).to.be.gt(initialBalance);
					}
				} catch (error: any) {
					// If there's no payout to claim, the transaction will revert
					expect(error.message).to.include('NoPayoutToClaim');
				}
			}

			// Check contract balance
			const contractBalance = await ethers.provider.getBalance(
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
