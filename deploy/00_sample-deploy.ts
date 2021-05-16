import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    console.log("ERC20Mock deployed");
    console.log("deployer :>> ", deployer);

    const name = "Badger";
    const symbol = "BADGER";
    const contract = await deploy("ERC20Mock", {
        from: deployer,
        args: [name, symbol],
        log: true,
    });

    console.log("ERC20Mock deployed");

    console.log("ERC20Mock address:", contract.address);
};

export default func;
module.exports.tags = ["ERC20Mock"];
