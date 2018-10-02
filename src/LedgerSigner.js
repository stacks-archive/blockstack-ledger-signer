import bsk from 'blockstack'
import btc from 'bitcoinjs-lib'
import AppBtc from 'ablankstein-ledger-hw-app-btc'

import { getTransaction, serializeOutputHex } from './utils'

export class LedgerSigner {
  constructor(hdPath, transportInterface) {
    this.hdPath = hdPath
    this.transportInterface = transportInterface
    this.address = null
  }

  obtainAppInterface() {
    return this.transportInterface.create()
      .then((transport) => new AppBtc(transport))
  }

  getAddress() {
    if (this.address) {
      return Promise.resolve(this.address)
    } else {
      return this.obtainAppInterface()
        .then(device => device.getWalletPublicKey(this.hdPath, false, false))
        .then(result => {
          this.address = bsk.config.network.coerceAddress(result.bitcoinAddress)
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
        .then((transaction) => appBtc.splitTransaction(transaction))
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
