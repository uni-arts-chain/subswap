import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { AddressZero } from 'ethers/constants'
import { bigNumberify } from 'ethers/utils'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'
import { getCreate2Address, expandTo18Decimals } from './shared/utilities'
import { factoryFixture } from './shared/fixtures'
import Pair from '../build/SubswapPair.json'
import ERC20 from '../build/ERC20.json'

chai.use(solidity)
const TOTAL_SUPPLY = expandTo18Decimals(10000)

let TEST_ADDRESSES: [string, string];

describe('Factory', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [wallet, other] = provider.getWallets()
  const loadFixture = createFixtureLoader(provider, [wallet, other])

  let factory: Contract
  let tokenA: Contract
  let tokenB: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(factoryFixture)
    factory = fixture.factory
    tokenA = await deployContract(wallet, ERC20, [TOTAL_SUPPLY])
    tokenB = await deployContract(wallet, ERC20, [TOTAL_SUPPLY])
    TEST_ADDRESSES = tokenA.address < tokenB.address ? [tokenA.address, tokenB.address] : [tokenB.address, tokenA.address]
  })

  it('feeTo, feeToSetter, allPairsLength', async () => {
    expect(await factory.feeTo()).to.eq(AddressZero)
    expect(await factory.feeToSetter()).to.eq(wallet.address)
    expect(await factory.allPairsLength()).to.eq(0)
  })

  async function createPair(tokens: [string, string]) {
    const bytecode = `0x${Pair.evm.bytecode.object}`
    const create2Address = getCreate2Address(factory.address, tokens, bytecode)
    await expect(factory.createPair(...tokens))
      .to.emit(factory, 'PairCreated')
      .withArgs(TEST_ADDRESSES[0], TEST_ADDRESSES[1], create2Address, bigNumberify(1))
    await expect(factory.createPair(...tokens)).to.be.reverted // UniswapV2: PAIR_EXISTS
    await expect(factory.createPair(...tokens.slice().reverse())).to.be.reverted // UniswapV2: PAIR_EXISTS
    expect(await factory.getPair(...tokens)).to.eq(create2Address)
    expect(await factory.getPair(...tokens.slice().reverse())).to.eq(create2Address)
    expect(await factory.allPairs(0)).to.eq(create2Address)
    expect(await factory.allPairsLength()).to.eq(1)

    const pair = new Contract(create2Address, JSON.stringify(Pair.abi), provider)
    expect(await pair.factory()).to.eq(factory.address)
    expect(await pair.token0()).to.eq(TEST_ADDRESSES[0])
    expect(await pair.token1()).to.eq(TEST_ADDRESSES[1])
  }

  // it('createPair', async () => {
  //   await createPair(TEST_ADDRESSES)
  // })

  // it('createPair:reverse', async () => {
  //   await createPair(TEST_ADDRESSES.slice().reverse() as [string, string])
  // })

  it('createPair:gas', async () => {
    const tx = await factory.createPair(...TEST_ADDRESSES)
    const receipt = await tx.wait()
    expect(receipt.gasUsed).to.eq(2807544)
  })

  it('setFeeTo', async () => {
    await expect(factory.connect(other).setFeeTo(other.address)).to.be.revertedWith('Subswap: FORBIDDEN')
    await factory.setFeeTo(wallet.address)
    expect(await factory.feeTo()).to.eq(wallet.address)
  })

  it('setFeeToSetter', async () => {
    await expect(factory.connect(other).setFeeToSetter(other.address)).to.be.revertedWith('Subswap: FORBIDDEN')
    await factory.setFeeToSetter(other.address)
    expect(await factory.feeToSetter()).to.eq(other.address)
    await expect(factory.setFeeToSetter(wallet.address)).to.be.revertedWith('Subswap: FORBIDDEN')
  })
})
