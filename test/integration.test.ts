import hre from "hardhat";
import { waffle, ethers } from "hardhat";
import { expect, use } from "chai";
import { deploy } from "./deploy";
import { StakingRewards } from "../typechain/StakingRewards";
import { StrategyBadgerRewards } from "../typechain/StrategyBadgerRewards";
import { Sett } from "../typechain/Sett";
import { ERC20Mock } from "../typechain/ERC20Mock";
import { Controller } from "../typechain/controller";
import { BadgerYieldSource } from "../typechain/BadgerYieldSource";
import { PrizePool } from "../typechain/prizePool";
import { RNGServiceMock } from "../typechain/RNGServiceMock";
import { PoolWithMultipleWinnersBuilder } from "../typechain/PoolWithMultipleWinnersBuilder";

import IYieldSource from "../artifacts/@pooltogether/yield-source-interface/contracts/IYieldSource.sol/IYieldSource.json";
import MultipleWinners from "../artifacts/@pooltogether/pooltogether-contracts/contracts/prize-strategy/multiple-winners/MultipleWinners.sol/MultipleWinners.json";

use(require("chai-bignumber")());

const toWei = ethers.utils.parseEther;
const AddressZero = ethers.constants.AddressZero;
const overrides = { gasLimit: 9500000 };
const amount = toWei("100");

async function getEvents(contract, tx) {
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    return receipt.logs.reduce((parsedEvents, log) => {
        try {
            parsedEvents.push(contract.interface.parseLog(log));
        } catch (e) {}
        return parsedEvents;
    }, []);
}

describe("BadgerYieldSource", async function () {
    const provider = waffle.provider;
    const [wallet, other, keeper, strategist, governance, guardian, reward, admin] = provider.getWallets();

    let badger: ERC20Mock;
    let sett: Sett;
    let yieldSource: BadgerYieldSource;
    let controller: Controller;
    let strategyBadgerRewards: StrategyBadgerRewards;
    let geyser: StakingRewards;
    let poolWithMultipleWinnersBuilder: PoolWithMultipleWinnersBuilder;
    let prizePool: PrizePool;
    let rngServiceMock: RNGServiceMock;
    let prizeStrategy;
    let yieldSourcePrizePoolABI: typeof IYieldSource.abi;
    let multipleWinnersABI: typeof MultipleWinners.abi;
    let Badger, Sett, YieldSource, Controller, StrategyBadgerRewards, Geyser;

    before(async function () {
        // deploy all the pool together.
        const ControlledTokenProxyFactory = await ethers.getContractFactory("ControlledTokenProxyFactory");
        const controlledTokenProxyFactory = await ControlledTokenProxyFactory.deploy(overrides);

        const TicketProxyFactory = await ethers.getContractFactory("TicketProxyFactory");
        const ticketProxyFactory = await TicketProxyFactory.deploy(overrides);

        const ControlledTokenBuilder = await ethers.getContractFactory("ControlledTokenBuilder");
        const controlledTokenBuilder = await ControlledTokenBuilder.deploy(
            ticketProxyFactory.address,
            controlledTokenProxyFactory.address,
            overrides,
        );

        const MultipleWinnersProxyFactory = await ethers.getContractFactory("MultipleWinnersProxyFactory");
        const multipleWinnersProxyFactory = await MultipleWinnersProxyFactory.deploy(overrides);

        const MultipleWinnersBuilder = await ethers.getContractFactory("MultipleWinnersBuilder");
        const multipleWinnersBuilder = await MultipleWinnersBuilder.deploy(
            multipleWinnersProxyFactory.address,
            controlledTokenBuilder.address,
            overrides,
        );

        const StakePrizePoolProxyFactory = await ethers.getContractFactory("StakePrizePoolProxyFactory");
        const stakePrizePoolProxyFactory = await StakePrizePoolProxyFactory.deploy(overrides);

        const YieldSourcePrizePoolProxyFactory = await ethers.getContractFactory("YieldSourcePrizePoolProxyFactory");
        const yieldSourcePrizePoolProxyFactory = await YieldSourcePrizePoolProxyFactory.deploy(overrides);

        const CompoundPrizePoolProxyFactory = await ethers.getContractFactory("CompoundPrizePoolProxyFactory");
        const compoundPrizePoolProxyFactory = await CompoundPrizePoolProxyFactory.deploy(overrides);

        const Registry = await ethers.getContractFactory("Registry");
        const registry = await Registry.deploy(overrides);

        const PoolWithMultipleWinnersBuilder = await ethers.getContractFactory("PoolWithMultipleWinnersBuilder");
        poolWithMultipleWinnersBuilder = (await PoolWithMultipleWinnersBuilder.deploy(
            registry.address,
            compoundPrizePoolProxyFactory.address,
            yieldSourcePrizePoolProxyFactory.address,
            stakePrizePoolProxyFactory.address,
            multipleWinnersBuilder.address,
            overrides,
        )) as PoolWithMultipleWinnersBuilder;
        yieldSourcePrizePoolABI = (await hre.artifacts.readArtifact("YieldSourcePrizePool")).abi;
        multipleWinnersABI = (await hre.artifacts.readArtifact("MultipleWinners")).abi;

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

        const yieldSourcePrizePoolConfig = {
            yieldSource: yieldSource.address,
            maxExitFeeMantissa: toWei("0.5"),
            maxTimelockDuration: 1000,
        };
        const RGNFactory = await ethers.getContractFactory("RNGServiceMock");
        rngServiceMock = (await RGNFactory.deploy({ gasLimit: 9500000 })) as RNGServiceMock;

        const decimals = 9;
        const multipleWinnersConfig = {
            proxyAdmin: AddressZero,
            rngService: rngServiceMock.address,
            prizePeriodStart: 0,
            prizePeriodSeconds: 100,
            ticketName: "bBadgerPass",
            ticketSymbol: "bBADGERp",
            sponsorshipName: "bBadgersponso",
            sponsorshipSymbol: "bBADGERsp",
            ticketCreditLimitMantissa: toWei("0.1"),
            ticketCreditRateMantissa: toWei("0.1"),
            externalERC20Awards: [],
            numberOfWinners: 1,
        } as any;
        const tx = await poolWithMultipleWinnersBuilder.createYieldSourceMultipleWinners(
            yieldSourcePrizePoolConfig,
            multipleWinnersConfig,
            decimals,
        );
        const events = await getEvents(poolWithMultipleWinnersBuilder, tx);
        const prizePoolCreatedEvent = events.find(e => e.name == "YieldSourcePrizePoolWithMultipleWinnersCreated");

        prizePool = (await ethers.getContractAt(
            yieldSourcePrizePoolABI,
            prizePoolCreatedEvent.args.prizePool,
            wallet,
        )) as PrizePool;
        prizeStrategy = await ethers.getContractAt(
            multipleWinnersABI,
            prizePoolCreatedEvent.args.prizeStrategy,
            wallet,
        );

        // activate Vault(aka sett)
        await sett.connect(governance).unpause();
        await sett.connect(governance).approveContractAccess(yieldSource.address);

        await badger.mint(wallet.address, amount);
        await badger.mint(other.address, amount);
        await badger.mint(geyser.address, amount.mul("10"));
    });

    it("get token address", async function () {
        expect(await yieldSource.depositToken()).to.equal(badger.address);
    });

    it("should return the underlying balance", async function () {
        await badger.connect(wallet).approve(prizePool.address, amount);
        const [tokenAddress] = await prizePool.tokens();
        await prizePool.depositTo(wallet.address, amount, tokenAddress, other.address);

        expect(await sett.balanceOf(yieldSource.address)).to.eq(amount);
    });
});
