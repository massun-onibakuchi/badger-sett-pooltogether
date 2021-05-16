const hre = require("hardhat");
const { waffle, ethers } = require("hardhat");
const { expect, use } = require("chai");
const toWei = ethers.utils.parseEther;

use(require("chai-bignumber")());

const badgerAddress = "0x3472A5A71965499acd81997a54BBA8D852C6E53d";
const badgerSettAddress = "0x19D97D8fA813EE2f51aD4B4e04EA08bAf4DFfC28";
const exchangeWalletAddress = "0xD551234Ae421e3BCBA99A0Da6d736074f22192FF";
const overrides = { gasLimit: 9500000 };

describe("BadgerYieldSource", async function () {
    const provider = waffle.provider;
    const [wallet, other] = provider.getWallets();
    const initialBadgerAmount = toWei("1000");

    let badger;
    let sett;
    let factory;
    let yieldSource;
    let badgerFactory;
    // eslint-disable-next-line no-undef
    before(async function () {
        // mainnet forking impersonate `exchangeWalletAddress`
        await hre.network.provider.request({
            mbadgerod: "hardhat_impersonateAccount",
            params: [exchangeWalletAddress],
        });

        sett = await badger.getVerifiedContractAt(badgerSettAddress); // creat contract instance without manually downloading ABI
        badgerFactory = await badger.getContractFactory("ERC20Mock", wallet);
        factory = await badger.getContractFactory("BadgerYieldSource", wallet);

        console.log("wallet.address :>> ", wallet.address);
        console.log("other.address :>> ", other.address);
    });

    // eslint-disable-next-line no-undef
    beforeEach(async function () {
        badger = await badgerFactory.deploy("badger", "BADGER", overrides);
        yieldSource = await factory.deploy(sett.address, badger.address, overrides);

        await badger.mint(wallet.address, initialBadgerAmount);
    });

    // eslint-disable-next-line no-undef
    it("should be able to get underkying token address", async function () {
        expect(await yieldSource.depositToken()) == badger.address;
    });

    it("should be able to get correct bBadger balance", async function () {
        const depositBadgerAmount = toWei("100");
        expect(await badger.balanceOf(wallet.address)).to.eq(initialBadgerAmount); // check
        // supply
        await badger.connect(wallet).approve(yieldSource.address, depositBadgerAmount);
        await yieldSource.connect(wallet).supplyTokenTo(depositBadgerAmount, wallet.address);

        const bBadgerBalance = await yieldSource.balanceOf(wallet.address); // wallet's bBadger balance
        expect(await sett.balanceOf(yieldSource.address)).eq(bBadgerBalance);
    });

    it("should be able to get correct amount `balanceOfToken`", async function () {
        const depositBadgerAmount = toWei("10");
        expect(await badger.balanceOf(wallet.address)).to.eq(initialBadgerAmount); // check
        // supply
        await badger.connect(wallet).approve(yieldSource.address, depositBadgerAmount);
        await yieldSource.connect(wallet).supplyTokenTo(depositBadgerAmount, wallet.address);

        const total = await sett.totalSupply();
        const shares = await sett.balanceOf(yieldSource.address);
        const bankBadger = await sett.totalBadger();
        const badgerBalance = shares.mul(bankBadger).div(total);
        const calculatedBalance = badgerBalance.mul(badgerBalance).div(total);

        expect(await yieldSource.balanceOfToken(wallet.address)).not.to.eq(calculatedBalance);
    });

    it("supplyToken and redeemToken", async function () {
        const depositBadgerAmount = toWei("10");
        // supply
        await badger.connect(wallet).approve(yieldSource.address, depositBadgerAmount);
        await yieldSource.connect(wallet).supplyTokenTo(depositBadgerAmount, wallet.address);
        expect(await yieldSource.balanceOfToken(wallet.address)) == depositBadgerAmount;
        // redeem
        await yieldSource.connect(wallet).redeemToken(depositBadgerAmount);
        expect(await yieldSource.balanceOfToken(wallet.address)).to.eq(toWei("0"));
    });

    it("prevent funds from being taken by unauthorized", async function () {
        await badger.connect(wallet).approve(yieldSource.address, toWei("100"));
        await yieldSource.supplyTokenTo(toWei("100"), wallet.address);

        await expect(yieldSource.connect(other).redeemToken(toWei("100"))).to.be.revertedWith(
            "SafeMath: subtraction overflow",
        );
    });
    it("is not affected by token transfered by accident", async function () {
        await badger.transfer(yieldSource.address, toWei("100"));
        expect(await yieldSource.balanceOfToken(wallet.address)).to.eq(toWei("0"));
    });
});
