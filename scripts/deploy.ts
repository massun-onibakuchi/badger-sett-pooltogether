import hre from "hardhat";
import { ethers } from "hardhat";
import { StakingRewards } from "../typechain/StakingRewards";
import { StrategyBadgerRewards } from "../typechain/StrategyBadgerRewards";
import { Sett } from "../typechain/Sett";
import { ERC20Mock } from "../typechain/ERC20Mock";
import { Controller } from "../typechain/controller";
import { BadgerYieldSource } from "../typechain/BadgerYieldSource";

const toWei = ethers.utils.parseEther;
const overrides = { gasLimit: 9500000 };

const main = async () => {
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
    // const { deployments, getNamedAccounts } = hre;
    // const { deploy } = deployments;
    // const { deployer } = await getNamedAccounts();

    const [wallet, other, keeper, strategist, governance, guardian, reward, admin] = await hre.ethers.getSigners();

    let badger: ERC20Mock;
    let sett: Sett;
    let yieldSource: BadgerYieldSource;
    let controller: Controller;
    let strategyBadgerRewards: StrategyBadgerRewards;
    let geyser: StakingRewards;
    let { Badger, Sett, YieldSource, Controller, StrategyBadgerRewards, Geyser } = await deploy();

    badger = (await Badger.deploy("Badger", "BADGER")) as ERC20Mock;
    sett = (await Sett.deploy(overrides)) as Sett;
    controller = (await Controller.deploy()) as Controller;
    geyser = (await Geyser.deploy()) as StakingRewards;
    strategyBadgerRewards = (await StrategyBadgerRewards.deploy()) as StrategyBadgerRewards;
    yieldSource = (await YieldSource.deploy(sett.address, badger.address, overrides)) as BadgerYieldSource;

    const wantConfig = [badger.address, geyser.address] as [string, string];
    const feeConfig = [toWei("0"), toWei("0"), toWei("0")] as any;

    console.log("badger.address :>> ", badger.address);
    console.log("sett.address :>> ", sett.address);
    console.log("controller.address :>> ", controller.address);
    console.log("geyser.address :>> ", geyser.address);
    console.log("yieldSource.address :>> ", yieldSource.address);

    // ----- initialize -----
    await geyser.initialize(admin.address, badger.address, badger.address, overrides);
    await strategyBadgerRewards.initialize(
        governance.address,
        strategist.address,
        controller.address,
        keeper.address,
        guardian.address,
        wantConfig,
        feeConfig,
        overrides,
    );
    await controller.initialize(governance.address, strategist.address, keeper.address, reward.address, overrides);

    // set Strategy
    await controller.connect(governance).approveStrategy(badger.address, strategyBadgerRewards.address, overrides);
    await controller.connect(governance).setStrategy(badger.address, strategyBadgerRewards.address, overrides);
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
};

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
