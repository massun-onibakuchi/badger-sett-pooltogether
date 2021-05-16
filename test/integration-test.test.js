const { ethers, waffle } = require("hardhat");
const hre = require("hardhat");
const { expect, assert, use } = require("chai");
const { BigNumber } = ethers;
const toWei = ethers.utils.parseEther;
const AddressZero = ethers.constants.AddressZero;

use(require("chai-bignumber")());

const badgerAddress = "0x3472A5A71965499acd81997a54BBA8D852C6E53d";
const settAddress = "0x19D97D8fA813EE2f51aD4B4e04EA08bAf4DFfC28";
const exchangeWalletAddress = "0xD551234Ae421e3BCBA99A0Da6d736074f22192FF";
const overrides = { gasLimit: 9500000 };

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
    const [wallet, other] = provider.getWallets();
    let badger;
    let sett;
    let YieldSourceFactory;
    let yieldSource;
    let poolWithMultipleWinnersBuilder;
    let prizePool;
    let prizeStrategy;
    let yieldSourcePrizePoolABI;
    let multipleWinnersABI;
    let rngServiceMock;
    // eslint-disable-next-line no-undef
    before(async function () {
        console.log("wallet.address :>> ", wallet.address);
        console.log("other.address :>> ", other.address);
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
        poolWithMultipleWinnersBuilder = await PoolWithMultipleWinnersBuilder.deploy(
            registry.address,
            compoundPrizePoolProxyFactory.address,
            yieldSourcePrizePoolProxyFactory.address,
            stakePrizePoolProxyFactory.address,
            multipleWinnersBuilder.address,
            { gasLimit: 9500000 },
        );
        YieldSourceFactory = await ethers.getContractFactory("BadgerYieldSource", other);

        // creat contract instance without manually downloading ABI
        sett = await ethers.getVerifiedContractAt(settAddress);
        badger = await ethers.getVerifiedContractAt(badgerAddress, other);

        yieldSourcePrizePoolABI = (await hre.artifacts.readArtifact("YieldSourcePrizePool")).abi;
        multipleWinnersABI = (await hre.artifacts.readArtifact("MultipleWinners")).abi;
    });

    // eslint-disable-next-line no-undef
    beforeEach(async function () {
        yieldSource = await YieldSourceFactory.deploy(sett.address, badger.address, {
            gasLimit: 9500000,
        });
        const yieldSourcePrizePoolConfig = {
            yieldSource: yieldSource.address,
            maxExitFeeMantissa: toWei("0.5"),
            maxTimelockDuration: 1000,
        };
        const RGNFactory = await ethers.getContractFactory("RNGServiceMock");
        rngServiceMock = await RGNFactory.deploy({ gasLimit: 9500000 });

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
        };
        const tx = await poolWithMultipleWinnersBuilder.createYieldSourceMultipleWinners(
            yieldSourcePrizePoolConfig,
            multipleWinnersConfig,
            decimals,
        );
        const events = await getEvents(poolWithMultipleWinnersBuilder, tx);
        const prizePoolCreatedEvent = events.find(e => e.name == "YieldSourcePrizePoolWithMultipleWinnersCreated");
        if (typeof prizePoolCreatedEvent.args.prizePool != "string")
            throw Error("YieldSourcePrizePoolWithMultipleWinnersCreated", prizePoolCreatedEvent.args);

        prizePool = await ethers.getContractAt(yieldSourcePrizePoolABI, prizePoolCreatedEvent.args.prizePool, wallet);
        prizeStrategy = await ethers.getContractAt(
            multipleWinnersABI,
            prizePoolCreatedEvent.args.prizeStrategy,
            wallet,
        );

        // get some badger
        await badger.transfer(wallet.address, BigNumber.from(100).mul(BigNumber.from(10).pow(18)));
    });

    // eslint-disable-next-line no-undef
    it("get token address", async function () {
        expect((await yieldSource.depositToken()) == badger);
    });

    it("should return the underlying balance", async function () {
        await badger.connect(wallet).approve(prizePool.address, toWei("100"));
        const [tokenAddress] = await prizePool.tokens();
        console.log("tokenAdderss :>> ", tokenAddress);
        await prizePool.depositTo(wallet.address, toWei("100"), tokenAddress, other.address);
        const balance = await sett.balanceOf(yieldSource.address);
        assert.isTrue(balance.gt(toWei("0")));
    });

    // it("should be able to withdraw instantly", async function () {
    //     await badger.connect(wallet).approve(prizePool.address, toWei("100"));
    //     const [tokenAddress] = await prizePool.tokens();

    //     await prizePool.depositTo(wallet.address, toWei("100"), tokenAddress, other.address);
    //     const balanceBefore = await badger.balanceOf(wallet.address);
    //     await prizePool.withdrawInstantlyFrom(
    //         wallet.address,
    //         toWei("1"),
    //         tokenAddress,
    //         1000, //The maximum exit fee the caller is willing to pay.
    //     );
    //     const balanceAfter = await badger.balanceOf(wallet.address);
    //     assert.isTrue(balanceAfter.gt(balanceBefore));
    // });
});
