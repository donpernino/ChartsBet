import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ChartsBetToken } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('ChartsBetToken', function () {
	let chartsBetToken: ChartsBetToken;
	let owner: HardhatEthersSigner;
	let addr1: HardhatEthersSigner;
	let addr2: HardhatEthersSigner;

	const MAX_SUPPLY = ethers.parseEther('1000000000'); // 1 billion tokens
	const TOKENS_PER_ETH = 100;

	beforeEach(async function () {
		[owner, addr1, addr2] = await ethers.getSigners();

		const ChartsBetTokenFactory = await ethers.getContractFactory(
			'ChartsBetToken'
		);
		chartsBetToken = await ChartsBetTokenFactory.deploy(
			await owner.getAddress()
		);
		await chartsBetToken.waitForDeployment();
	});

	describe('Deployment', function () {
		it('Should set the right owner', async function () {
			expect(await chartsBetToken.owner()).to.equal(
				await owner.getAddress()
			);
		});

		it('Should assign the total supply of tokens to the owner', async function () {
			const ownerBalance = await chartsBetToken.balanceOf(
				await owner.getAddress()
			);
			expect(await chartsBetToken.totalSupply()).to.equal(ownerBalance);
		});
	});

	describe('Transactions', function () {
		it('Should transfer tokens between accounts', async function () {
			await chartsBetToken.transfer(await addr1.getAddress(), 50);
			const addr1Balance = await chartsBetToken.balanceOf(addr1.address);
			expect(addr1Balance).to.equal(50);

			await chartsBetToken.connect(addr1).transfer(addr2.address, 50);
			const addr2Balance = await chartsBetToken.balanceOf(addr2.address);
			expect(addr2Balance).to.equal(50);
		});

		it('Should fail if sender does not have enough tokens', async function () {
			const initialOwnerBalance = await chartsBetToken.balanceOf(
				owner.address
			);
			await expect(
				chartsBetToken.connect(addr1).transfer(owner.address, 1)
			).to.be.revertedWithCustomError(
				chartsBetToken,
				'ERC20InsufficientBalance'
			);
			expect(await chartsBetToken.balanceOf(owner.address)).to.equal(
				initialOwnerBalance
			);
		});
	});

	describe('Pause and Unpause', function () {
		it('Should pause and unpause the contract', async function () {
			await chartsBetToken.pause();
			expect(await chartsBetToken.paused()).to.be.true;

			await chartsBetToken.unpause();
			expect(await chartsBetToken.paused()).to.be.false;
		});

		it('Should not allow transfers when paused', async function () {
			await chartsBetToken.pause();
			await expect(
				chartsBetToken.transfer(addr1.address, 50)
			).to.be.revertedWithCustomError(chartsBetToken, 'EnforcedPause');
		});
	});

	describe('Minting', function () {
		it('Should allow owner to mint tokens', async function () {
			const initialSupply = await chartsBetToken.totalSupply();
			await chartsBetToken.mint(addr1.address, 1000);
			expect(await chartsBetToken.balanceOf(addr1.address)).to.equal(
				1000
			);
			expect(await chartsBetToken.totalSupply()).to.equal(
				initialSupply + 1000n
			);
		});

		it('Should not allow minting beyond max supply', async function () {
			const currentSupply = await chartsBetToken.totalSupply();
			const amountToMint = MAX_SUPPLY - currentSupply + 1n;
			await expect(
				chartsBetToken.mint(addr1.address, amountToMint)
			).to.be.revertedWith('Minting would exceed max supply');
		});
	});

	describe('Buying and Selling Tokens', function () {
		it('Should allow buying tokens', async function () {
			const ethAmount = ethers.parseEther('1');
			await expect(
				chartsBetToken.connect(addr1).buyTokens({ value: ethAmount })
			)
				.to.emit(chartsBetToken, 'TokensPurchased')
				.withArgs(
					addr1.address,
					ethAmount,
					ethAmount * BigInt(TOKENS_PER_ETH)
				);

			expect(await chartsBetToken.balanceOf(addr1.address)).to.equal(
				ethAmount * BigInt(TOKENS_PER_ETH)
			);
		});

		it('Should allow selling tokens', async function () {
			// First, buy some tokens
			const ethAmount = ethers.parseEther('1');
			await chartsBetToken.connect(addr1).buyTokens({ value: ethAmount });

			// Then sell half of them
			const tokenAmount = (ethAmount * BigInt(TOKENS_PER_ETH)) / 2n;
			await expect(chartsBetToken.connect(addr1).sellTokens(tokenAmount))
				.to.emit(chartsBetToken, 'TokensSold')
				.withArgs(addr1.address, tokenAmount, ethAmount / 2n);

			expect(await chartsBetToken.balanceOf(addr1.address)).to.equal(
				tokenAmount
			);
		});
	});

	describe('ETH Withdrawal', function () {
		it('Should allow owner to withdraw ETH', async function () {
			// First, have someone buy tokens to add ETH to the contract
			const ethAmount = ethers.parseEther('1');
			await chartsBetToken.connect(addr1).buyTokens({ value: ethAmount });

			const initialBalance = await ethers.provider.getBalance(
				owner.address
			);
			await chartsBetToken.withdrawETH(ethAmount);
			const finalBalance = await ethers.provider.getBalance(
				owner.address
			);

			expect(finalBalance).to.be.gt(initialBalance);
		});

		it('Should not allow non-owners to withdraw ETH', async function () {
			await expect(
				chartsBetToken.connect(addr1).withdrawETH(1000)
			).to.be.revertedWithCustomError(
				chartsBetToken,
				'OwnableUnauthorizedAccount'
			);
		});
	});

	describe('Receive Function', function () {
		it('Should buy tokens when receiving ETH', async function () {
			const ethAmount = ethers.parseEther('1');
			await expect(
				addr1.sendTransaction({
					to: await chartsBetToken.getAddress(),
					value: ethAmount,
				})
			)
				.to.emit(chartsBetToken, 'TokensPurchased')
				.withArgs(
					addr1.address,
					ethAmount,
					ethAmount * BigInt(TOKENS_PER_ETH)
				);

			expect(await chartsBetToken.balanceOf(addr1.address)).to.equal(
				ethAmount * BigInt(TOKENS_PER_ETH)
			);
		});
	});

	describe('New Functionality', function () {
		it('Should allow owner to distribute rewards', async function () {
			const rewardAmount = ethers.parseEther('1000');
			await expect(
				chartsBetToken.distributeReward(addr1.address, rewardAmount)
			)
				.to.emit(chartsBetToken, 'RewardDistributed')
				.withArgs(addr1.address, rewardAmount);

			expect(await chartsBetToken.balanceOf(addr1.address)).to.equal(
				rewardAmount
			);
		});

		it('Should not allow minting more than 1% of MAX_SUPPLY at once', async function () {
			const maxMintAmount =
				((await chartsBetToken.MAX_SUPPLY()) *
					BigInt(await chartsBetToken.MAX_MINT_PERCENT())) /
				100n;
			const tooMuchAmount = maxMintAmount + 1n;

			await expect(
				chartsBetToken.mint(addr1.address, tooMuchAmount)
			).to.be.revertedWith(
				'Cannot mint more than 1% of MAX_SUPPLY at once'
			);
		});

		it('Should allow burning tokens', async function () {
			const initialBalance = await chartsBetToken.balanceOf(
				owner.address
			);
			const burnAmount = ethers.parseEther('1000');

			await chartsBetToken.burn(burnAmount);

			const finalBalance = await chartsBetToken.balanceOf(owner.address);
			expect(finalBalance).to.equal(initialBalance - burnAmount);
		});
	});
});
