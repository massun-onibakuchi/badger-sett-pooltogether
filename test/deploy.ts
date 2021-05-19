import { ethers } from "hardhat";

export const deploy = async () => {
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
