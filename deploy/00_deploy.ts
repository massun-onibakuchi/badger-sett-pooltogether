import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    console.log("BadgerYieldSource deployed");
    console.log("deployer :>> ", deployer);

    const badgerSettAddress = "0x19D97D8fA813EE2f51aD4B4e04EA08bAf4DFfC28";
    const badgerAddress = "0x3472A5A71965499acd81997a54BBA8D852C6E53d";
    const contract = await deploy("BadgerYieldSource", {
        from: deployer,
        args: [badgerSettAddress, badgerAddress],
        log: true,
    });

    console.log("BadgerYieldSource deployed");

    console.log("BadgerYieldSource address:", contract.address);
};

export default func;
module.exports.tags = ["BadgerYieldSource"];
