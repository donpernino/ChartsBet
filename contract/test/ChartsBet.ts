import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ChartsBet } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('ChartsBet Contract', function () {
	let chartsBet: ChartsBet;
	let owner: HardhatEthersSigner;
	let addr1: HardhatEthersSigner;
	let addr2: HardhatEthersSigner;

	beforeEach(async function () {
		[owner, addr1, addr2] = await ethers.getSigners();

		const ChartsBetFactory = await ethers.getContractFactory('ChartsBet');
		chartsBet = await ChartsBetFactory.deploy(await owner.getAddress());
		await chartsBet.waitForDeployment();

		await chartsBet.initialize();
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
			const betAmount = ethers.parseEther('0.1');
			await expect(
				chartsBet
					.connect(addr1)
					.placeBet(
						ethers.encodeBytes32String('WW'),
						ethers.encodeBytes32String('Artist'),
						{ value: betAmount }
					)
			)
				.to.emit(chartsBet, 'BetPlaced')
				.withArgs(
					await addr1.getAddress(),
					ethers.encodeBytes32String('WW'),
					(day: any) => typeof day === 'bigint',
					ethers.encodeBytes32String('Artist'),
					betAmount,
					(odds: any) => typeof odds === 'bigint'
				);
		});

		it('Should revert if bet is too high', async function () {
			const betAmount = ethers.parseEther('2');
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
	});

	describe('closePoolAndAnnounceWinner', function () {
		beforeEach(async function () {
			await chartsBet.openAllDailyPools();
		});

		it('Should close pool and announce winner', async function () {
			await ethers.provider.send('evm_increaseTime', [86400]);
			await ethers.provider.send('evm_mine', []);

			const currentDay = Math.floor(Date.now() / 86400000);
			await expect(
				chartsBet.closePoolAndAnnounceWinner(
					ethers.encodeBytes32String('WW'),
					currentDay,
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
			console.log('Pools opened');

			const artists = Array(10)
				.fill(0)
				.map((_, i) => ethers.encodeBytes32String(`Artist${i}`));
			await chartsBet.updateTop10(
				ethers.encodeBytes32String('WW'),
				artists
			);
			console.log('Top 10 updated');

			const betAmount = ethers.parseEther('0.1');
			const tx = await chartsBet
				.connect(addr1)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist0'),
					{ value: betAmount }
				);
			const receipt = await tx.wait();

			// Vérifier l'événement Debug pour le placement du pari
			const debugEvents = receipt?.logs.filter(
				(log) =>
					log.topics[0] ===
					ethers.id('Debug(string,bytes32,uint256,address,uint256)')
			);
			console.log('Debug events from placeBet:', debugEvents);

			await ethers.provider.send('evm_increaseTime', [86400]);
			await ethers.provider.send('evm_mine', []);
			console.log('Time advanced');

			const currentDay = Math.floor(Date.now() / 86400000);
			await chartsBet.closePoolAndAnnounceWinner(
				ethers.encodeBytes32String('WW'),
				currentDay,
				ethers.encodeBytes32String('Artist0')
			);
			console.log('Pool closed and winner announced');

			// Capturer tous les événements lors du règlement du pari
			const settleTx = await chartsBet
				.connect(addr1)
				.settleBet(ethers.encodeBytes32String('WW'), currentDay);
			const settleReceipt = await settleTx.wait();

			// Afficher tous les événements émis lors du règlement
			console.log('All events from settleBet:', settleReceipt?.logs);

			// Vérifier si l'événement BetSettled a été émis
			const betSettledEvent = settleReceipt?.logs.find(
				(log) =>
					log.topics[0] ===
					ethers.id(
						'BetSettled(address,bytes32,uint256,uint256,bool)'
					)
			);
			expect(betSettledEvent).to.not.be.undefined;

			if (betSettledEvent) {
				const [bettor, country, day, amount, won] =
					ethers.AbiCoder.defaultAbiCoder().decode(
						['address', 'bytes32', 'uint256', 'uint256', 'bool'],
						betSettledEvent.data
					);
				console.log('BetSettled event data:', {
					bettor,
					country,
					day,
					amount,
					won,
				});
			}
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

		it('Should allow owner to withdraw', async function () {
			await chartsBet.openAllDailyPools();
			await chartsBet.updateTop10(
				ethers.encodeBytes32String('WW'),
				Array(10).fill(ethers.encodeBytes32String('Artist'))
			);
			await chartsBet
				.connect(addr1)
				.placeBet(
					ethers.encodeBytes32String('WW'),
					ethers.encodeBytes32String('Artist'),
					{ value: ethers.parseEther('0.1') }
				);

			const initialBalance = await ethers.provider.getBalance(
				owner.address
			);
			await chartsBet.withdraw();
			const finalBalance = await ethers.provider.getBalance(
				owner.address
			);

			expect(finalBalance).to.be.gt(initialBalance);
		});
	});
});
