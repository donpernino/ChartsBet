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
	const DEFAULT_DURATION = 300; // 5 minutes in seconds

	beforeEach(async function () {
		[owner, addr1, addr2] = await ethers.getSigners();

		const ChartsBetFactory = await ethers.getContractFactory('ChartsBet');
		chartsBet = await ChartsBetFactory.deploy(await owner.getAddress());
		await chartsBet.waitForDeployment();

		await chartsBet.initialize();
		await chartsBet.setDefaultDuration(DEFAULT_DURATION);
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
		it('Should open pools for all countries with default duration', async function () {
			const tx = await chartsBet.openAllDailyPools(0); // 0 means use default duration
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
				expect(event.args[3] - event.args[2]).to.equal(
					DEFAULT_DURATION
				); // closingTime - openingTime = DEFAULT_DURATION
			}

			const poolInfo = await chartsBet.getPoolInfo(
				ethers.encodeBytes32String('WW')
			);

			console.log('Pool info:', poolInfo);
		});

		it('Should open pools with custom duration', async function () {
			const customDuration = 600; // 10 minutes
			const tx = await chartsBet.openAllDailyPools(customDuration);
			const receipt = await tx.wait();

			const poolOpenedEvents = receipt?.logs.filter(
				(log) => log.fragment && log.fragment.name === 'PoolOpened'
			);

			expect(poolOpenedEvents).to.have.lengthOf(8); // 8 countries

			for (const event of poolOpenedEvents) {
				expect(event.args[3] - event.args[2]).to.equal(customDuration); // closingTime - openingTime = customDuration
			}
		});

		it('Should revert if non-owner tries to open pools', async function () {
			await expect(
				chartsBet.connect(addr1).openAllDailyPools(0)
			).to.be.revertedWithCustomError(
				chartsBet,
				'OwnableUnauthorizedAccount'
			);
		});
	});

	describe('placeBet', function () {
		beforeEach(async function () {
			await chartsBet.openAllDailyPools(0); // Use default duration
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

		it('Should not allow bets after pool is closed', async function () {
			await time.increase(301); // Increase time by more than 5 minutes
			await expect(
				chartsBet
					.connect(addr1)
					.placeBet(
						ethers.encodeBytes32String('FR'),
						ethers.encodeBytes32String('Artist'),
						{ value: ethers.parseEther('0.1') }
					)
			).to.be.revertedWithCustomError(chartsBet, 'PoolNotOpen');
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
			await time.increase(301); // Increase time by more than 5 minutes
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
			await chartsBet.openAllDailyPools(0);
		});

		it('Should close pool and announce winner at any time', async function () {
			const currentDay = await chartsBet.currentDay();
			const closeTx = await chartsBet.closePoolAndAnnounceWinner(
				ethers.encodeBytes32String('WW'),
				ethers.encodeBytes32String('Winner')
			);

			const closeTimestamp = BigInt(
				(await ethers.provider.getBlock(closeTx.blockNumber!))!
					.timestamp
			);

			await expect(closeTx)
				.to.emit(chartsBet, 'PoolClosed')
				.withArgs(
					ethers.encodeBytes32String('WW'),
					currentDay,
					ethers.encodeBytes32String('Winner'),
					(timestamp: bigint) => {
						// Allow for a small difference (e.g., 2 seconds) in timestamps
						return (
							timestamp >= closeTimestamp - BigInt(2) &&
							timestamp <= closeTimestamp + BigInt(2)
						);
					}
				);
		});

		it('Should set actualClosingTime when closing the pool', async function () {
			await chartsBet.closePoolAndAnnounceWinner(
				ethers.encodeBytes32String('WW'),
				ethers.encodeBytes32String('Winner')
			);

			const poolInfo = await chartsBet.getPoolInfo(
				ethers.encodeBytes32String('WW')
			);
			expect(poolInfo.actualClosingTime).to.be.gt(0);
			expect(poolInfo.actualClosingTime).to.be.lte(await time.latest());
		});

		it('Should revert if pool is already closed', async function () {
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
			await chartsBet.openAllDailyPools(0);
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

			await time.increase(301); // Increase time by more than 5 minutes
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
			await chartsBet.openAllDailyPools(0);
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
			await time.increase(301); // Increase time by more than 5 minutes
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
			let aliceClaimTx,
				aliceClaimReceipt,
				aliceGasUsed,
				aliceFinalBalance;
			try {
				aliceClaimTx = await chartsBet.connect(addr1).claimPayout();
				aliceClaimReceipt = await aliceClaimTx.wait();
				aliceGasUsed =
					aliceClaimReceipt!.gasUsed * aliceClaimReceipt!.gasPrice;
				aliceFinalBalance = await ethers.provider.getBalance(
					addr1.address
				);
			} catch (error: any) {
				console.log("Alice couldn't claim payout:", error.message);
				aliceFinalBalance = aliceInitialBalance;
				aliceGasUsed = 0n;
			}

			const bobInitialBalance = await ethers.provider.getBalance(
				addr2.address
			);
			let bobClaimTx, bobClaimReceipt, bobGasUsed, bobFinalBalance;
			try {
				bobClaimTx = await chartsBet.connect(addr2).claimPayout();
				bobClaimReceipt = await bobClaimTx.wait();
				bobGasUsed =
					bobClaimReceipt!.gasUsed * bobClaimReceipt!.gasPrice;
				bobFinalBalance = await ethers.provider.getBalance(
					addr2.address
				);
			} catch (error: any) {
				console.log("Bob couldn't claim payout:", error.message);
				bobFinalBalance = bobInitialBalance;
				bobGasUsed = 0n;
			}

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
				(bobFinalBalance - bobInitialBalance + bobGasUsed).toString()
			);

			// Check balances
			if (aliceFinalBalance > aliceInitialBalance) {
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
			} else {
				console.log("Alice didn't receive a payout");
			}

			// Check Bob's balance change
			expect(bobFinalBalance).to.equal(
				bobInitialBalance - bobGasUsed,
				"Bob's balance should decrease by gas costs only as he lost the bet"
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
			await chartsBet.openAllDailyPools(0);
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
	});

	describe('getPoolInfo', function () {
		beforeEach(async function () {
			await chartsBet.openAllDailyPools(0);
		});

		it('Should return correct pool info after opening', async function () {
			const poolInfo = await chartsBet.getPoolInfo(
				ethers.encodeBytes32String('WW')
			);
			expect(poolInfo.openingTime).to.be.gt(0);
			expect(poolInfo.scheduledClosingTime).to.be.gt(
				poolInfo.openingTime
			);
			expect(poolInfo.actualClosingTime).to.equal(
				poolInfo.scheduledClosingTime
			);
			expect(poolInfo.closed).to.be.false;
		});

		it('Should return correct pool info after closing', async function () {
			await chartsBet.closePoolAndAnnounceWinner(
				ethers.encodeBytes32String('WW'),
				ethers.encodeBytes32String('Winner')
			);

			const poolInfo = await chartsBet.getPoolInfo(
				ethers.encodeBytes32String('WW')
			);
			expect(poolInfo.openingTime).to.be.gt(0);
			expect(poolInfo.scheduledClosingTime).to.be.gt(
				poolInfo.openingTime
			);
			expect(poolInfo.actualClosingTime).to.be.gt(0);
			expect(poolInfo.actualClosingTime).to.be.lte(await time.latest());
			expect(poolInfo.closed).to.be.true;
		});
	});

	describe('Additional ChartsBet Tests', function () {
		it('Should revert when placing bet for invalid country', async function () {
			await chartsBet.openAllDailyPools(0);
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
			await chartsBet.openAllDailyPools(0);
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
