const bsk = require('blockstack')
import Transport from '@ledgerhq/hw-transport-node-hid'
import AppBtc from '@ledgerhq/hw-app-btc'
import { getTransaction } from './utils'
import { LedgerSigner } from './LedgerSigner'
import BigInteger from 'bigi'

const SINGLE_SIG_PATH = `0'/0/0`
const FUNDER_KEY = 'b94e0a49f76b605b37508a8dd7ed465aac4591d57993abe2f286421e35f1dcd901'

export async function getBTCAddress() {
  const transport = await Transport.create()
  const btc = new AppBtc(transport)
  const result = await btc.getWalletPublicKey(SINGLE_SIG_PATH, false, false)
  return { singleSigAddress: bsk.config.network.coerceAddress(result.bitcoinAddress),
           funderAddress: bsk.ecPairToAddress(
             bsk.hexStringToECPair(FUNDER_KEY)) }
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

export function setTestnet (TESTNET = '172.17.0.2') {
  bsk.config.network = bsk.network.defaults.LOCAL_REGTEST
  bsk.config.network.blockstackAPIUrl    = `http://${TESTNET}:16268`
  bsk.config.network.broadcastServiceUrl = `http://${TESTNET}:16269`
  bsk.config.network.btc.bitcoindUrl     = `http://${TESTNET}:18332`
}

setTestnet()
getBTCAddress().then((address) => {
  console.log(`Ledger Addresses:\n ${JSON.stringify(address, undefined, 2)}`)
}).then(() => {
  return doMakeStacksTransfer('miiprdeiQ72wpm4s5nfagmR2AzGqYfPmPT')
    .then(x => bsk.config.network.broadcastTransaction(x))
    .then(x => console.log(`Broadcast result: ${x}`))
})
