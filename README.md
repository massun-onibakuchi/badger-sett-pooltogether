# Badger Sett PoolTogether

Badger Sett and PoolTogether Integration.

PoolTogether is Prize Savings Protocol Ethereum smart contracts.  
For an overview of the concepts and API please see the [documentation](https://docs.pooltogether.com/)

## Concept

The poolTogether protocol has several pre-built yield source integrations sush as Compound.
In addition, PoolTogether can use a custom yield source by implementing the IYieldSource interface.
`BadgerYieldSource` integrates Badger Sett (aka Vault) as a yield source.

Badger Sett

-   Badger deposited into the pool is to be wrapped into bBadger
-   Automatically compounded

[Badger Finance Doc](https://badger-finance.gitbook.io/badger-finance/)

Rinkeby

-   BadgerYieldSource `0x07d392a6c061433EE0120a630edBB428f3000143`
-   Badger `0xe8b277855CC7D14A2DeEde6482d310AF079C9779`
-   Sett `0x2674f399c59916a2131248B9BCfC23C61a4Ae1D4`
-   Controller `0x12e84ea041f40a10752348ee4F04A8882346C842`
-   Geyser(StakingRewards) `0x1f68eCc4bc4052A4Fa6508834f53a3f7Bc121e89`

## Setup

To install dependencies,run  
`yarn`

You will needs to enviroment variables to run the tests.
Create a `.env` file in the root directory of your project.

```
ETHERSCAN_API_KEY=
ALCHEMY_API_KEY=
RINKEYBY_ALCHEMY_API_KEY=
```

You will get the first one from [Etherscan](https://etherscan.io/).
You will get the second one from [Alchemy](https://dashboard.alchemyapi.io/).

## Compile

`yarn build`

## Test

`yarn test`

## Local Deployment

`npx hardhat run --network hardhat scripts/deploy.ts`
