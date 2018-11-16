import { config as bskConfig } from 'blockstack'
import btc from 'bitcoinjs-lib'
import AppBtc from 'ablankstein-ledger-hw-app-btc'

import { getTransaction, serializeOutputHex } from './utils'

export class LedgerSigner {
  constructor(hdPath, transportInterface) {
    this.hdPath = hdPath
    this.transportInterface = transportInterface
    this.address = null
    this.transport = null
  }

  obtainAppInterface() {
    if (this.transport) {
      return Promise.resolve(this.transport)
    } else {
      return this.transportInterface.create()
        .then((transport) => {
          transport = new AppBtc(transport)
          this.transport = transport
          return transport
        })
    }
  }

  // Return the public key string
  static getPublicKeys(transportInterface, paths) {
    const results = []
    return transportInterface.create()
      .then((transport) => new AppBtc(transport))
      .then(ledger => {
        return paths.reduce(
            (promise, path) => promise.then((prior) => {
              if (prior) {
                results.push(prior)
              }
              return ledger.getWalletPublicKey(path, false, false)
            }), Promise.resolve())
          .then((finalResult) => results.push(finalResult))
      })
      .then(() => results.map(
        result => {
          const uncompressed = result.publicKey
          const ecPair = btc.ECPair.fromPublicKey(Buffer.from(uncompressed, 'hex'))
          ecPair.compressed = true
          return ecPair.publicKey
        }))
      .then(pubkeyBuffers => pubkeyBuffers.map(pk => pk.toString('hex')))
  }

  getAddress() {
    if (this.address) {
      return Promise.resolve(this.address)
    } else {
      return this.obtainAppInterface()
        .then(device => device.getWalletPublicKey(this.hdPath, false, false))
        .then(result => {
          this.address = bskConfig.network.coerceAddress(result.bitcoinAddress)
          return this.address
        })
    }
  }

  prepareInputs(tx, signInputIndex, appBtc) {
    const inputScripts = tx.ins.map((input, index) => {
      if (index !== signInputIndex) {
        return input.script.toString('hex')
      } else {
        return null
      }
    })

    const inputsPromises = tx.ins.map((input) => {
      const txId = Buffer.from(input.hash).reverse().toString('hex')
      const outputN = input.index
      return getTransaction(txId)
        .then((transaction) => {
          const hasWitness = btc.Transaction.fromHex(transaction).hasWitnesses()
          return appBtc.splitTransaction(transaction, hasWitness)
        })
        .then((preparedTx) => ([ preparedTx, outputN, undefined, input.sequence ]))
    })

    return Promise.all(inputsPromises)
      .then((inputs) => ({ inputs, inputScripts }))
  }

  prepareTransactionInfo(tx, signInputIndex, appBtc) {
    const sigHashType = 1 // SIGHASH_ALL
    const signPaths = tx.ins.map((input, index) => {
      if (index === signInputIndex) {
        return this.hdPath
      } else {
        return null
      }
    })
    const outputHex = serializeOutputHex(tx)
    const lockTime = tx.locktime
    return this.prepareInputs(tx, signInputIndex, appBtc)
      .then((result) => {
        const { inputs, inputScripts } = result
        return { inputs, inputScripts, signPaths,
                 outputHex, lockTime, sigHashType }
      })
  }

  signTransaction(txB, signInputIndex) {
    return this.signTransactionSkeleton(txB.__tx, signInputIndex)
      .then((signedTxHex) => {
        // god of abstraction, forgive me, for I have transgressed
        const signedTx = btc.Transaction.fromHex(signedTxHex)
        const signedTxB = btc.TransactionBuilder.fromTransaction(signedTx)
        txB.__inputs[signInputIndex] = signedTxB.__inputs[signInputIndex]
      })
  }

  signTransactionSkeleton(tx, signInputIndex) {
    return this.obtainAppInterface()
      .then((appBtc) => this.prepareTransactionInfo(tx, signInputIndex, appBtc)
            .then((txInfo) => {
              return appBtc.createPaymentTransactionNew(
                txInfo.inputs,
                txInfo.signPaths,
                undefined,
                txInfo.outputHex,
                txInfo.lockTime,
                txInfo.sigHashType,
                false,
                undefined,
                undefined,
                undefined,
                txInfo.inputScripts)
            }))
      .catch(err => {
        console.log(err)
        console.log(err.stack)
        console.log(err.message)
        console.log(err.statusCode)
        console.log(err.statusText)
      })
  }
}
