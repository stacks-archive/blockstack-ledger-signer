const bsk = require('blockstack')
import Transport from '@ledgerhq/hw-transport-node-hid'
import btc from 'bitcoinjs-lib'
import AppBtc from '@ledgerhq/hw-app-btc'
import { getTransaction } from './utils'
import { LedgerSigner } from './LedgerSigner'
import { LedgerMultiSigSigner } from './LedgerMultiSigSigner'
import { NullSigner } from './NullSigner'
import BigInteger from 'bigi'

const SINGLE_SIG_PATH = `0'/0/0`
const FUNDER_KEY = 'b94e0a49f76b605b37508a8dd7ed465aac4591d57993abe2f286421e35f1dcd901'

const MULTI_1 = `m/44'/5757'/0'/0/1`
const MULTI_2 = `m/44'/5757'/0'/0/2`
const MULTI_3 = `m/44'/5757'/0'/0/3`


export async function getBTCAddress() {
  const transport = await Transport.create()
  const ledger = new AppBtc(transport)
  const result = await ledger.getWalletPublicKey(SINGLE_SIG_PATH, false, false)
  return { singleSigAddress: bsk.config.network.coerceAddress(result.bitcoinAddress),
           funderAddress: bsk.ecPairToAddress(
             bsk.hexStringToECPair(FUNDER_KEY)) }
}

export async function getMultiSigInfo() {
  const transport = await Transport.create()
  const ledger = new AppBtc(transport)
  const pk1Uncompressed = await ledger.getWalletPublicKey(MULTI_1, false, false)
  const pk2Uncompressed = await ledger.getWalletPublicKey(MULTI_2, false, false)
  const pk3Uncompressed = await ledger.getWalletPublicKey(MULTI_3, false, false)
  const pubkeys = [pk1Uncompressed, pk2Uncompressed, pk3Uncompressed].map(
    (pkResult => {
      const publicKey = pkResult.publicKey
      const ecPair = btc.ECPair.fromPublicKey(Buffer.from(publicKey, 'hex'))
      ecPair.compressed = true
      return ecPair.publicKey
    }))
  const redeem = btc.payments.p2ms({ m: 2, pubkeys })
  const script = btc.payments.p2sh({ redeem })
  const address = script.address
  return {
    address: {
      multiSigAddress: bsk.config.network.coerceAddress(address),
      funderAddress: bsk.ecPairToAddress(
        bsk.hexStringToECPair(FUNDER_KEY))
    },
    redeemScript: redeem.output.toString('hex')
  }
}

function  broadcastTransaction(transaction) {
    const jsonRPC = {
      jsonrpc: '1.0',
      method: 'sendrawtransaction',
      params: [transaction]
    }
    const bitcoindCredentials = bsk.config.network.btc.bitcoindCredentials
    const bitcoindUrl = bsk.config.network.btc.bitcoindUrl
    const authString =      Buffer.from(`${bitcoindCredentials.username}:${bitcoindCredentials.password}`)
      .toString('base64')
    const headers = { Authorization: `Basic ${authString}` }
    return fetch(bitcoindUrl, {
      method: 'POST',
      body: JSON.stringify(jsonRPC),
      headers
    })
    .then(resp => resp.json())
}

function doMakeStacksTransfer (destination) {
  const txSigner = new LedgerSigner(SINGLE_SIG_PATH)

  return bsk.transactions.makeTokenTransfer(destination,
                                            'STACKS',
                                            BigInteger.fromHex('50'),
                                            'single-sig-hello',
                                            txSigner,
                                            FUNDER_KEY,
                                            true)
    .then(rawTX => {
      console.log('=== TRANSFER TX ===')
      console.log(rawTX)
      return rawTX
    })
}


function signTransactionMore(txHex, inputN, path, redeemScript) {
  const tx = btc.Transaction.fromHex(txHex)
  const TxB = btc.TransactionBuilder.fromTransaction(tx)

  const txSigner = new LedgerMultiSigSigner(path, redeemScript)
  return txSigner.signTransaction(TxB, inputN)
    .then(() => {
      const tx = TxB.build().toHex()
      console.log('== SIGNED TX ==')
      console.log(tx)
      return tx
    })
}


function doMakeStacksTransferMulti (destination, payerAddress) {
  const txSigner = new NullSigner(payerAddress)
  return bsk.transactions.makeTokenTransfer(destination,
                                            'STACKS',
                                            BigInteger.fromHex('50'),
                                            'multi-sig-hello',
                                            txSigner,
                                            FUNDER_KEY,
                                            true)
    .then(rawTX => {
      console.log('=== TRANSFER TX ===')
      console.log(rawTX)
      return rawTX
    })
}

export function setTestnet (TESTNET = '172.17.0.2') {
  bsk.config.network = bsk.network.defaults.LOCAL_REGTEST
  bsk.config.network.blockstackAPIUrl    = `http://${TESTNET}:16268`
  bsk.config.network.broadcastServiceUrl = `http://${TESTNET}:16269`
  bsk.config.network.btc.bitcoindUrl     = `http://${TESTNET}:18332`
}

function runSingleSigTest() {
  setTestnet()
  getBTCAddress().then((address) => {
    console.log(`Ledger Addresses:\n ${JSON.stringify(address, undefined, 2)}`)
  }).then(() => {
    return doMakeStacksTransfer('miiprdeiQ72wpm4s5nfagmR2AzGqYfPmPT')
      .then(x => bsk.config.network.broadcastTransaction(x))
      .then(x => console.log(`Broadcast result: ${x}`))
  })
}


function runMultiSigTest() {
  setTestnet()
  getMultiSigInfo()
    .then((info) => {
      console.log(`Ledger Addresses:\n ${JSON.stringify(info.address, undefined, 2)}`)
      console.log(`Ledger Addresses:\n ${JSON.stringify(info.redeemScript, undefined, 2)}`)
      return doMakeStacksTransferMulti('miiprdeiQ72wpm4s5nfagmR2AzGqYfPmPT', info.address.multiSigAddress)
        .then(rawTX => signTransactionMore(rawTX, 0, MULTI_2, info.redeemScript))
        .then(signedOnce => signTransactionMore(signedOnce, 0, MULTI_1, info.redeemScript))
        .then(x => broadcastTransaction(x))
        .then(x => console.log(`Broadcast result: ${JSON.stringify(x, undefined, 2)}`))
    })
}

runMultiSigTest()
