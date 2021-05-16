import { run, ethers } from "hardhat";

async function main() {
    const accounts = await ethers.getSigners();
    console.log(
        "Accounts:",
        accounts.map(a => a.address),
    );

    const badgerSettAddress = "0x19D97D8fA813EE2f51aD4B4e04EA08bAf4DFfC28";

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const erc20 = await ERC20Mock.deploy();
    await erc20.deployed();

    const YieldSource = await ethers.getContractFactory("BadgerYieldSource");
    const yieldSource = await YieldSource.deploy(badgerSettAddress, erc20.address);
    await yieldSource.deployed();

    console.log("yieldSource.address :>> ", yieldSource.address);
    console.log("erc20.address :>> ", erc20.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
