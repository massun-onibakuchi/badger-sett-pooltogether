import { waffle, ethers } from "hardhat";
import { expect, use } from "chai";
import { ContractFactory } from "@ethersproject/contracts";

import { Sett } from "../typechain/Sett";
import { ERC20Mock } from "../typechain/ERC20Mock";
import { BadgerYieldSource } from "../typechain/BadgerYieldSource";

const toWei = ethers.utils.parseEther;
use(require("chai-bignumber")());

const overrides = { gasLimit: 9500000 };
const amount = toWei("100");

describe("BadgerYieldSource", async function () {
    const provider = waffle.provider;
    const [wallet, keeper, controller, governance, guardian] = provider.getWallets();

    let badger: ERC20Mock;
    let sett: Sett;
    let yieldSource: BadgerYieldSource;
    let Sett: ContractFactory;
    let Badger: ContractFactory;
    let YieldSource: ContractFactory;
    before(async function () {
        Badger = await ethers.getContractFactory("ERC20Mock");
        Sett = await ethers.getContractFactory("Sett");
        YieldSource = await ethers.getContractFactory("BadgerYieldSource");
    });

    beforeEach(async function () {
        badger = (await Badger.deploy("Badger", "BADGER")) as ERC20Mock;
        sett = (await Sett.deploy(overrides)) as Sett;
        sett.initialize(
            badger.address,
            controller.address,
            governance.address,
            keeper.address,
            guardian.address,
            false,
            "",
            "",
            overrides,
        );
        yieldSource = (await YieldSource.deploy(sett.address, badger.address, overrides)) as BadgerYieldSource;

        await sett.connect(governance).unpause();
        await sett.connect(governance).approveContractAccess(yieldSource.address);
        await badger.mint(wallet.address, amount);
    });

    it("should be able to get underkying token address", async function () {
        expect(await yieldSource.depositToken()).to.equal(badger.address);
    });

    it("should be able to get correct bBadger balance", async function () {
        // check
        expect(await badger.balanceOf(wallet.address)).to.eq(amount);
        // supply
        await badger.connect(wallet).approve(yieldSource.address, amount);
        await yieldSource.connect(wallet).supplyTokenTo(amount, wallet.address);

        const bBadgerBalance = await yieldSource.balanceOf(wallet.address);
        expect(await sett.balanceOf(yieldSource.address)).eq(bBadgerBalance);
    });

    // it("should be able to get correct amount `balanceOfToken`", async function () {
    //     const depositBadgerAmount = toWei("10");
    //     expect(await badger.balanceOf(wallet.address)).to.eq(initialBadgerAmount); // check
    //     // supply
    //     await badger.connect(wallet).approve(yieldSource.address, depositBadgerAmount);
    //     await yieldSource.connect(wallet).supplyTokenTo(depositBadgerAmount, wallet.address);

    //     const total = await sett.totalSupply();
    //     const shares = await sett.balanceOf(yieldSource.address);
    //     const bankBadger = await sett.totalBadger();
    //     const badgerBalance = shares.mul(bankBadger).div(total);
    //     const calculatedBalance = badgerBalance.mul(badgerBalance).div(total);

    //     expect(await yieldSource.balanceOfToken(wallet.address)).not.to.eq(calculatedBalance);
    // });

    // it("supplyToken and redeemToken", async function () {
    //     const depositBadgerAmount = toWei("10");
    //     // supply
    //     await badger.connect(wallet).approve(yieldSource.address, depositBadgerAmount);
    //     await yieldSource.connect(wallet).supplyTokenTo(depositBadgerAmount, wallet.address);
    //     expect(await yieldSource.balanceOfToken(wallet.address)) == depositBadgerAmount;
    //     // redeem
    //     await yieldSource.connect(wallet).redeemToken(depositBadgerAmount);
    //     expect(await yieldSource.balanceOfToken(wallet.address)).to.eq(toWei("0"));
    // });

    // it("prevent funds from being taken by unauthorized", async function () {
    //     await badger.connect(wallet).approve(yieldSource.address, toWei("100"));
    //     await yieldSource.supplyTokenTo(toWei("100"), wallet.address);

    //     await expect(yieldSource.connect(other).redeemToken(toWei("100"))).to.be.revertedWith(
    //         "SafeMath: subtraction overflow",
    //     );
    // });
    // it("is not affected by token transfered by accident", async function () {
    //     await badger.transfer(yieldSource.address, toWei("100"));
    //     expect(await yieldSource.balanceOfToken(wallet.address)).to.eq(toWei("0"));
    // });
});
