import { waffle, ethers } from "hardhat";
import { expect, use } from "chai";

import { StakingRewards } from "../typechain/StakingRewards";
import { StrategyBadgerRewards } from "../typechain/StrategyBadgerRewards";
import { Sett } from "../typechain/Sett";
import { ERC20Mock } from "../typechain/ERC20Mock";
import { Controller } from "../typechain/controller";
import { BadgerYieldSource } from "../typechain/BadgerYieldSource";

const toWei = ethers.utils.parseEther;
use(require("chai-bignumber")());

const overrides = { gasLimit: 9500000 };
const amount = toWei("100");

describe("BadgerYieldSource", async function () {
    const provider = waffle.provider;
    const [wallet, other, keeper, strategist, governance, guardian, reward, admin] = provider.getWallets();

    let badger: ERC20Mock;
    let sett: Sett;
    let yieldSource: BadgerYieldSource;
    let controller: Controller;
    let strategyBadgerRewards: StrategyBadgerRewards;
    let geyser: StakingRewards;
    const deploy = async () => {
        const [Badger, Sett, YieldSource, Controller, StrategyBadgerRewards, Geyser] = await Promise.all([
            ethers.getContractFactory("ERC20Mock"),
            ethers.getContractFactory("Sett"),
            ethers.getContractFactory("BadgerYieldSource"),
            ethers.getContractFactory("Controller"),
            ethers.getContractFactory("StrategyBadgerRewards"),
            ethers.getContractFactory("StakingRewards"),
        ]);
        return { Badger, Sett, YieldSource, Controller, StrategyBadgerRewards, Geyser };
    };
    let Badger, Sett, YieldSource, Controller, StrategyBadgerRewards, Geyser;
    before(async () => {
        ({ Badger, Sett, YieldSource, Controller, StrategyBadgerRewards, Geyser } = await deploy());
    });

    beforeEach(async function () {
        badger = (await Badger.deploy("Badger", "BADGER")) as ERC20Mock;
        sett = (await Sett.deploy(overrides)) as Sett;
        controller = (await Controller.deploy()) as Controller;
        geyser = (await Geyser.deploy()) as StakingRewards;
        strategyBadgerRewards = (await StrategyBadgerRewards.deploy()) as StrategyBadgerRewards;
        yieldSource = (await YieldSource.deploy(sett.address, badger.address, overrides)) as BadgerYieldSource;

        const wantConfig = [badger.address, geyser.address] as [string, string];
        const feeConfig = [toWei("0"), toWei("0"), toWei("0")] as any;
        // ----- initialize -----
        await geyser.initialize(admin.address, badger.address, badger.address);
        await strategyBadgerRewards.initialize(
            governance.address,
            strategist.address,
            controller.address,
            keeper.address,
            guardian.address,
            wantConfig,
            feeConfig,
        );
        await controller.initialize(governance.address, strategist.address, keeper.address, reward.address);
        // set Strategy
        await controller.connect(governance).approveStrategy(badger.address, strategyBadgerRewards.address);
        await controller.connect(governance).setStrategy(badger.address, strategyBadgerRewards.address);
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
        // activate Vault(aka sett)
        await sett.connect(governance).unpause();
        await sett.connect(governance).approveContractAccess(yieldSource.address);

        await badger.mint(wallet.address, amount);
        await badger.mint(other.address, amount);
        await badger.mint(geyser.address, amount.mul("10"));
    });

    it("get underkying token address", async function () {
        expect(await yieldSource.depositToken()).to.equal(badger.address);
    });

    it("balanceOfToken", async function () {
        // check
        expect(await badger.balanceOf(wallet.address)).to.eq(amount);
        // supply
        await badger.connect(wallet).approve(yieldSource.address, amount);
        await yieldSource.supplyTokenTo(amount, wallet.address);

        const bBadgerBalance = await yieldSource.balanceOf(wallet.address);
        expect(await sett.balanceOf(yieldSource.address)).eq(bBadgerBalance);
    });

    it("supplyTokenTo", async function () {
        expect(await badger.balanceOf(sett.address)).to.eq(0);
        expect(await badger.balanceOf(wallet.address)).to.eq(amount);

        await badger.connect(wallet).approve(yieldSource.address, amount);
        await yieldSource.supplyTokenTo(amount, wallet.address);

        expect(await badger.balanceOf(sett.address)).to.eq(amount);
        expect(await yieldSource.balanceOfToken(wallet.address)).to.eq(amount);
    });

    it("redeemToken", async function () {
        await badger.connect(wallet).approve(yieldSource.address, amount);
        await yieldSource.supplyTokenTo(amount, wallet.address);

        expect(await badger.balanceOf(wallet.address)).to.eq(toWei("0"));
        await yieldSource.redeemToken(amount);
        expect(await badger.balanceOf(wallet.address)).to.eq(amount);
    });
});
