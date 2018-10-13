const bsk = require('blockstack')
import FetchMock from 'fetch-mock'
import btc from 'bitcoinjs-lib'
import { NullSigner, LedgerSigner,
         LedgerMultiSigSigner, getMultiSigInfo } from '../../lib'

import test from 'tape'

const FUNDER_KEY_0 = 'cf0a48131c07cbef652f929af118bb9adbf58e76843f268ac5feeaac7e45b79401'
const FUNDER_KEY_1 = '1ecfe0beaa102e81bb2f373c35e84da526b0cacf96bd4f4742362122d21a56e301'
const MULTISIG_PARTICIPANT = 'aece5b5120db05223fb304fc5f7e281a492f59699a0947d7717c6020419a0bf401'
const MULTISIG2_PARTICIPANT = '18fbcdf45fd34916797ad0d99c4d8b6e2aa0081581525b9259073a46a14035ed01'

const EXPECTED_TX_SINGLE_SIG = '0100000002f0b86f063a21a1bc01507d1f3f73736ca0ef38fcb0ed53fe3ac8f55e8215f50f000000006a47304402204f91dc120b54c687d01831a3f0f86ed9d08d760b9ff8fa2a757dbdcf46c48d3e022014cb2c7cb6b58c34d79198709452bb7e72c862f51f347b1f1f6906fa47896dee0121038f4a8de57da614fba3e54a9a539fbcf6bcbfdafda18049e0363d364d6c20b65afffffffff0b86f063a21a1bc01507d1f3f73736ca0ef38fcb0ed53fe3ac8f55e8215f50f010000006b483045022100931820e88b4982477992f06effc199bed7985b8b1c9fa018b3e17c07a3baef8702207a8485a553f0a45d9890f921c5b9e22626fa3305ced1e84f96f5ed69c608e651012103a4a12bf55a419a4c9b294af2d495aa9b5c22d26919d59e449babe43e5b2dc7eaffffffff030000000000000000296a2769642b61a031b0619c742f844bfdad056dc8eaa3ce3ad1d4d49c70ba3b9690de27ac2e1aa48f87a0860100000000001976a9141051a2fbf5e138834794ebdf5c55f4e1e5bf79c688ac60790400000000001976a91467210e6662257f44a36d323d51a5be8045c02b1c88ac00000000'
const EXPECTED_TX_MULTI_SIG  = '010000000282ae52ace7e8f146f09d0569df25d419b6131539b84a0e034bc81f9ba28f632100000000fd1e010047304402206ab3e617fa04d3ff7e35bacbd8ba1a4cd95ac895ad67217633076c32a9ede8d202207422e454ae2cdeb41dbdd0c9d34fad9014e7382a23dd28675bfedfe490e31e240147304402205174524e89297b23dd080603fc9ffc44bf0abf70372f070f8ddaebfff1624ff30220384311dd3cf5f9b04fc1be3f5bf67f9861dc0e2506d956a58ce8338383cbcf11014c8b522103602e13a370e1286506c5edaaf61bfec36657b8538db8993ceb0d2cdf84696ddf2103ade026e1ce39be89e4fa03101d6ff7c8eb1630e4e28034ad6aceca39f42b8c682103d19b37f66f58a4eb9b63ca0d857a65327061087b2f7f447d32822b4c045477f621032f1fa70655e2cef519f1d4849d54a96bfd62ff78d86b6473313ee24755f3dd0254aeffffffff8151d1095efdfab9c0312d4e1583d9fa2f1a07b5603b481eb382e3803158a0e6000000006a47304402204b4d1c53e4c5c0d0407e4f402a05842eb61265cf2c7578bae5e4173dfb485dc302204c4028e22ba9e9a2fe9b8beaa1b27d34b97b75cc172c608510fa5ddd4b2a386a0121023642bd39fe11ee6cbef71effb6a337274c646c3abcd8b825303a46ad1e273e08ffffffff030000000000000000296a2769642b61a031b0619c742f844bfdad056dc8eaa3ce3ad1d4d49c70ba3b9690de27ac2e1aa48f87a08601000000000017a9146c7eccea2183a6fca2cea68b473f8ba468acf8e6873e520400000000001976a9146f0deabd3762e9ff981b31406297b323b1b0330f88ac00000000'

function setupMocks() {
  FetchMock.restore()

  const mocks = [
    { k: 'https://bitcoinfees.earn.com/api/v1/fees/recommended',
      v: { fastestFee: 16, halfHourFee: 16, hourFee: 6 } },
    { k: 'https://core.blockstack.org/v1/blockchains/bitcoin/consensus',
      v: {"consensus_hash": "570b8abdacc8138fb313bf868c3c84c3"} },
    { k: 'https://blockchain.info/unspent?format=json&active=1AQJCYjDKHaxFqTa4Q3eQB6RovwJ53Bmbt&cors=true',
      v: {
        "unspent_outputs": [
          {
            "tx_hash": "f0b86f063a21a1bc01507d1f3f73736ca0ef38fcb0ed53fe3ac8f55e8215f50f",
            "tx_hash_big_endian": "0ff515825ef5c83afe53edb0fc38efa06c73733f1f7d5001bca1213a066fb8f0",
            "tx_index": 380501736,
            "tx_output_n": 1,
            "script": "76a91467210e6662257f44a36d323d51a5be8045c02b1c88ac",
            "value": 300000,
            "value_hex": "0493e0",
            "confirmations": 1
          }
        ]
      }},
    { k: 'https://blockchain.info/unspent?format=json&active=12VHcHTF93t7xQQaVifc54XBDJcLSRTxk2&cors=true',
      v: {
        "unspent_outputs": [
          {
            "tx_hash": "f0b86f063a21a1bc01507d1f3f73736ca0ef38fcb0ed53fe3ac8f55e8215f50f",
            "tx_hash_big_endian": "0ff515825ef5c83afe53edb0fc38efa06c73733f1f7d5001bca1213a066fb8f0",
            "tx_index": 380501736,
            "tx_output_n": 0,
            "script": "76a9141051a2fbf5e138834794ebdf5c55f4e1e5bf79c688ac",
            "value": 100000,
            "value_hex": "0186a0",
            "confirmations": 2
          }
        ]
      }
    },
    { k: 'https://blockchain.info/rawtx/0ff515825ef5c83afe53edb0fc38efa06c73733f1f7d5001bca1213a066fb8f0?format=hex',
      v: '01000000018694fee1f97f1d4c34a8cdd7be9bbbacfd17c428fbadb437f44cf838c3001812010000006a4730440220276f022f0f4e23488c9aa8c1ad7477db222c5ed4ee2ae40a5de1448714fdcd20022055b72f5f68fa71c5ef4551f1ebe39dcf28672e6cfd9216ccee005c7d9abff3f3012103a5abddf3867d53e69a6766dab7a02bf8292130641bc64785d86fe3832d969c8efeffffff02a0860100000000001976a9141051a2fbf5e138834794ebdf5c55f4e1e5bf79c688ace0930400000000001976a91467210e6662257f44a36d323d51a5be8045c02b1c88ac5c520800' },
    { k: 'https://blockchain.info/unspent?format=json&active=13VL8U3nDpwLafHzLBx5nkj9HVwp15cVoF&cors=true',
      v: {
        "unspent_outputs": [
          {
            "tx_hash": "04a122561e84b78dc76fed0086e8566b24dc65e2a3b151104b147fc327d61e1a",
            "tx_hash_big_endian": "1a1ed627c37f144b1051b1a3e265dc246b56e88600ed6fc78db7841e5622a104",
            "tx_index": 380514929,
            "tx_output_n": 0,
            "script": "76a9141b4bddc998cbe79299de5cfd68a77811217ebb5888ac",
            "value": 291583,
            "value_hex": "0472ff",
            "confirmations": 1
          }
        ]
      } },
    { k : 'https://blockchain.info/unspent?format=json&active=3BagoWbDntM4S99HM8unPSABRVUYyyJeRk&cors=true',
      v: {
  "unspent_outputs": [
    {
      "tx_hash": "82ae52ace7e8f146f09d0569df25d419b6131539b84a0e034bc81f9ba28f6321",
      "tx_hash_big_endian": "21638fa29b1fc84b030e4ab8391513b619d425df69059df046f1e8e7ac52ae82",
      "tx_index": 380516950,
      "tx_output_n": 0,
      "script": "a9146c7eccea2183a6fca2cea68b473f8ba468acf8e687",
      "value": 100000,
      "value_hex": "0186a0",
      "confirmations": 1
    }
  ]
      }
    },
    { k: 'https://blockchain.info/rawtx/21638fa29b1fc84b030e4ab8391513b619d425df69059df046f1e8e7ac52ae82?format=hex',
      v: '01000000000101d99f6b0c3dd057b503bd9ae08868568cb17219c6e492c3ae2bdaff10ff5136320100000000ffffffff02a08601000000000017a9146c7eccea2183a6fca2cea68b473f8ba468acf8e687be050000000000001600147a8afe6ea5aae536798fef70c722b16cb92ba70a0247304402204c50fbe25b11913eb757e77b3b1c6ea80fb421d17094fefe823530e80b4f092702205ae53f34d87bcd8c82931d15ce87ae9e7d41ace1b0de22ee92414e552e7ce7180121020c6115df08aee80c435def6a3916b2133542e50f34d567fa1f4a771443c08cff00000000' },
    { k: 'https://blockchain.info/rawtx/66540833eaaf51088e1823421594feb352fd4a399a147bc6d046932398c7124e?format=hex',
      v: '0100000001a026d0d4a7a16ccc4caa9e8140245791353ed8f17fdd1b3d15d9245af9983bec010000006a473044022059df80da49c7050c566f01f6eacea3880598bdddde05a6d490e54bf0be81bf9a022062283559b4bf5f28e185b8bfaa0c3f33b71556227453509d5492adc9f10b41fd0121038f4a8de57da614fba3e54a9a539fbcf6bcbfdafda18049e0363d364d6c20b65afeffffff01508001000000000017a9144ccf46b9b16f9bcbd01118e41c9796f82acf914c8767520800' },
    { k: 'https://blockchain.info/rawtx/1a1ed627c37f144b1051b1a3e265dc246b56e88600ed6fc78db7841e5622a104?format=hex',
      v: '0100000001a026d0d4a7a16ccc4caa9e8140245791353ed8f17fdd1b3d15d9245af9983bec020000006a47304402203d4d16d00311e10d5643195b4e655c412668cff11e3a10fb64ad53f853907fe902205f53d167a6560410b8ac4517a24513d1a329d59d3e6f10aa82dd887bafd442e3012103a4a12bf55a419a4c9b294af2d495aa9b5c22d26919d59e449babe43e5b2dc7eafeffffff01ff720400000000001976a9141b4bddc998cbe79299de5cfd68a77811217ebb5888ac66520800' },
    { k: 'https://blockchain.info/rawtx/e6a0583180e382b31e483b60b5071a2ffad983154e2d31c0b9fafd5e09d15181?format=hex',
      v: '010000000104a122561e84b78dc76fed0086e8566b24dc65e2a3b151104b147fc327d61e1a000000006a473044022077c398ef76367d9dfc6b95566779c72a5e61b2ca9fe92f62d0f1d0aef281ffd90220408cf3103fa21d2ee1c03958e3fa2f54b39088c8844ee23102b7ef8c000296350121026589496651301fba395ce0d35103de85c8fed58c40a3a93d40da7e455d28d16bfeffffff019e6c0400000000001976a9146f0deabd3762e9ff981b31406297b323b1b0330f88ac69520800' },
    { k: 'https://blockchain.info/unspent?format=json&active=1B8CgG4x4FfSfpNH2Ge3tfh9XdsnpbR8er&cors=true',
      v: {
        "unspent_outputs": [
          {
            "tx_hash": "8151d1095efdfab9c0312d4e1583d9fa2f1a07b5603b481eb382e3803158a0e6",
            "tx_hash_big_endian": "e6a0583180e382b31e483b60b5071a2ffad983154e2d31c0b9fafd5e09d15181",
            "tx_index": 380518247,
            "tx_output_n": 0,
            "script": "76a9146f0deabd3762e9ff981b31406297b323b1b0330f88ac",
            "value": 289950,
            "value_hex": "046c9e",
            "confirmations": 89
          }
        ]
      } },
  ]

  mocks.forEach(mock => FetchMock.get(mock.k, mock.v))
}

function testSingleSig(transportInterface) {
  test('single sig ledger', (t) => {
    t.plan(1)
    setupMocks()

    const payerAddress = bsk.publicKeyToAddress(
      bsk.getPublicKeyFromPrivate(FUNDER_KEY_0.slice(0, -2)))

    const signer = new LedgerSigner(`m/44'/5757'/0'/0/0`, transportInterface)
    return signer.getAddress()
      .then(ownerAddress => {
        console.log(JSON.stringify({ownerAddress,
                                    payerAddress}))
      })
      .then(() => bsk.transactions.makeUpdate('ledgerio.id',
                                              signer,
                                              FUNDER_KEY_0,
                                              'ledger says hello'))
      .then((rawTX) => {
        t.equal(rawTX, EXPECTED_TX_SINGLE_SIG)
        console.log(rawTX)
      })
      .catch((err) => {
        console.log(err)
        t.fail()
      })
  })
}

function testMultiSig1(transportInterface) {
  test('multi-sig-test-1', (t) => {
    t.plan(1)
    setupMocks()

    const payerAddress = bsk.publicKeyToAddress(
      bsk.getPublicKeyFromPrivate(FUNDER_KEY_1.slice(0, -2)))

    const ownerPubKeyPaths = [1, 2, 3].map(i => `m/44'/5757'/0'/0/${i}`)

    return LedgerSigner.getPublicKeys(transportInterface, ownerPubKeyPaths)
      .then((pubkeys) => {
        console.log(JSON.stringify(pubkeys, null, 2))
        const ownerPubKeys = pubkeys.map(pkHex => Buffer.from(pkHex, 'hex'))
        const extraPubKeyHex = bsk.getPublicKeyFromPrivate(MULTISIG_PARTICIPANT.slice(0, -2))
        ownerPubKeys.push(Buffer.from(extraPubKeyHex, 'hex'))
        return getMultiSigInfo(ownerPubKeys, 2)
      })
      .then((ownerMultiSigInfo) => {
        console.log(JSON.stringify({ ownerAddress: ownerMultiSigInfo.address,
                                     payerAddress }, undefined, 2))
        const signer = new NullSigner(ownerMultiSigInfo.address)
        return bsk.transactions.makeUpdate('ledgerio.id',
                                           signer,
                                           FUNDER_KEY_1,
                                           'ledger says hello',
                                           undefined,
                                           true)
          .then((onceSignedTX) => {
            console.log('->')
            console.log(onceSignedTX)
            const asTXB = btc.TransactionBuilder.fromTransaction(
              btc.Transaction.fromHex(onceSignedTX), bsk.config.network.layer1)
            const ecPair = bsk.hexStringToECPair( MULTISIG_PARTICIPANT )
            asTXB.sign(0, ecPair, Buffer.from(ownerMultiSigInfo.redeemScript, 'hex'))
            return asTXB.build().toHex()
          })
          .then((unsignedTX) => {
            console.log('->')
            console.log(unsignedTX)

            const asTXB = btc.TransactionBuilder.fromTransaction(
              btc.Transaction.fromHex(unsignedTX))

            const txSigner = new LedgerMultiSigSigner(`m/44'/5757'/0'/0/3`,
                                                      ownerMultiSigInfo.redeemScript,
                                                      transportInterface)
            return txSigner.signTransaction(asTXB, 0)
                .then(() => asTXB.build().toHex())
          })
          .then((finishedTX) => {
            console.log('Completed:')
            console.log(finishedTX)
            t.equal(finishedTX, EXPECTED_TX_MULTI_SIG)
          })
      })
      .catch((err) => {
        console.log(err)
        t.fail()
      })
  })
}

function testMultiSig2(transportInterface) {
  test('multi-sig-test-2', (t) => {
    t.plan(1)
    setupMocks()

    const payerAddress = bsk.publicKeyToAddress(
      bsk.getPublicKeyFromPrivate(FUNDER_KEY_1.slice(0, -2)))

    const ownerPubKeyPaths = [1, 2, 3].map(i => `m/44'/5757'/0'/0/${i}`)

    return LedgerSigner.getPublicKeys(transportInterface, ownerPubKeyPaths)
      .then((pubkeys) => {
        const ownerPubKeys = pubkeys.map(pkHex => Buffer.from(pkHex, 'hex'))
        const extraPubKeyHex = bsk.getPublicKeyFromPrivate(MULTISIG_PARTICIPANT.slice(0, -2))
        ownerPubKeys.push(Buffer.from(extraPubKeyHex, 'hex'))
        return getMultiSigInfo(ownerPubKeys, 2)
      })
      .then((ownerMultiSigInfo) => {
        console.log(JSON.stringify({ ownerAddress: ownerMultiSigInfo.address,
                                     payerAddress }, undefined, 2))
        const signer = new NullSigner(ownerMultiSigInfo.address)
        return bsk.transactions.makeUpdate('ledgerio.id',
                                           signer,
                                           FUNDER_KEY_1,
                                           'ledger says hello',
                                           undefined,
                                           true)
          .then((unsignedTX) => {
            console.log('->')
            console.log(unsignedTX)

            const asTXB = btc.TransactionBuilder.fromTransaction(
              btc.Transaction.fromHex(unsignedTX), bsk.config.network.layer1)
            const ecPair = bsk.hexStringToECPair( MULTISIG2_PARTICIPANT )
            asTXB.sign(0, ecPair, Buffer.from(ownerMultiSigInfo.redeemScript, 'hex'))
            return asTXB.build().toHex()
          })
          .then((onceSignedTX) => {
            console.log('->')
            console.log(onceSignedTX)
            const asTXB = btc.TransactionBuilder.fromTransaction(
              btc.Transaction.fromHex(onceSignedTX), bsk.config.network.layer1)
            const ecPair = bsk.hexStringToECPair( MULTISIG_PARTICIPANT )
            asTXB.sign(0, ecPair, Buffer.from(ownerMultiSigInfo.redeemScript, 'hex'))
            return asTXB.build().toHex()
          })
          .then((finishedTX) => {
            console.log('Completed:')
            console.log(finishedTX)
          })

      })
      .catch((err) => {
        console.log(err)
      })
  })
}


function testMultiSig3(transportInterface) {
  test('multi-sig-test-3', (t) => {
    t.plan(1)
    setupMocks()

    const payerAddress = bsk.publicKeyToAddress(
      bsk.getPublicKeyFromPrivate(FUNDER_KEY_1.slice(0, -2)))

    const ownerPubKeyPaths = [1, 2, 3].map(i => `m/44'/5757'/0'/0/${i}`)

    return LedgerSigner.getPublicKeys(transportInterface, ownerPubKeyPaths)
      .then((pubkeys) => {
        console.log(JSON.stringify(pubkeys, null, 2))
        const ownerPubKeys = pubkeys.map(pkHex => Buffer.from(pkHex, 'hex'))
        const extraPubKeyHex = bsk.getPublicKeyFromPrivate(MULTISIG_PARTICIPANT.slice(0, -2))
        ownerPubKeys.push(Buffer.from(extraPubKeyHex, 'hex'))
        return getMultiSigInfo(ownerPubKeys, 2)
      })
      .then((ownerMultiSigInfo) => {
        console.log(JSON.stringify({ ownerAddress: ownerMultiSigInfo.address,
                                     payerAddress }, undefined, 2))
        const signer = new NullSigner(ownerMultiSigInfo.address)
        return bsk.transactions.makeUpdate('ledgerio.id',
                                           signer,
                                           FUNDER_KEY_1,
                                           'ledger says hello',
                                           undefined,
                                           true)
          .then((unsignedTX) => {
            console.log('->')
            console.log(unsignedTX)

            const asTXB = btc.TransactionBuilder.fromTransaction(
              btc.Transaction.fromHex(unsignedTX))

            const txSigner = new LedgerMultiSigSigner(`m/44'/5757'/0'/0/3`,
                                                      ownerMultiSigInfo.redeemScript,
                                                      transportInterface)
            return txSigner.signTransaction(asTXB, 0)
                .then(() => asTXB.build().toHex())
          })
          .then((onceSignedTX) => {
            console.log('->')
            console.log(onceSignedTX)
            const asTXB = btc.TransactionBuilder.fromTransaction(
              btc.Transaction.fromHex(onceSignedTX), bsk.config.network.layer1)
            const ecPair = bsk.hexStringToECPair( MULTISIG_PARTICIPANT )
            asTXB.sign(0, ecPair, Buffer.from(ownerMultiSigInfo.redeemScript, 'hex'))
            return asTXB.build().toHex()
          })
          .then((finishedTX) => {
            console.log('Completed:')
            console.log(finishedTX)
            t.equal(finishedTX, EXPECTED_TX_MULTI_SIG)
          })
      })
      .catch((err) => {
        console.log(err)
        t.fail()
      })
  })
}


const TESTS = [
  { name: 'single-sig',
    run: testSingleSig },
  { name: 'multi-sig-1',
    run: testMultiSig1 },
  { name: 'multi-sig-3',
    run: testMultiSig3 }, ]

export function runTests(getTransportClass) {
  TESTS.reduce((promise, test) => {
    return promise.then(() => test.run(getTransportClass(test.name)))
  }, Promise.resolve())

  return new Promise((resolve, reject) => {
    test.onFinish(resolve)
  })
}
