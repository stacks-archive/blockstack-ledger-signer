const bsk = require('blockstack')
import btc from 'bitcoinjs-lib'
import Transport from '@ledgerhq/hw-transport-node-hid'
import AppBtc from '@ledgerhq/hw-app-btc'

import { getTransaction, pathToPathArray,
         getCoinName, serializeOutputHex } from './utils'

class MockKeyPair {
  constructor(signature: Buffer, publicKey: Buffer) {
    this.signature = signature
    this.publicKey = publicKey
  }

  sign() {
    return this.signature
  }
}

export class LedgerMultiSigSigner {
  constructor(hdPath: string, redeemScript: string, transportInterface: object) {
    this.transportInterface = transportInterface
    this.hdPath = hdPath
    this.redeemScript = Buffer.from(redeemScript, 'hex')
    this.publicKey
  }

  obtainAppInterface() {
    return this.transportInterface.create()
      .then((transport) => new AppBtc(transport))
  }

  getPublicKey(): Promise<Buffer> {
    if (this.publicKey) {
      return Promise.resolve(this.publicKey)
    } else {
      return this.obtainAppInterface()
        .then(device => device.getWalletPublicKey(this.hdPath, false, false))
        .then(result => result.publicKey)
        .then(publicKey => {
          const ecPair = btc.ECPair.fromPublicKey(Buffer.from(publicKey, 'hex'))
          ecPair.compressed = true
          return ecPair.publicKey
        })
        .then(publicKeyBuffer => {
          this.publicKey = publicKeyBuffer
          return this.publicKey
        })
    }
  }

  getAddress() {
    const p2ms = btc.payments.p2ms({ output: this.redeemScript })
    const p2sh = btc.payments.p2sh({ redeem: p2ms })
    return Promise.resolve(bsk.config.network.coerceAddress(p2sh.address))
  }

  prepareInputs(tx, signInputIndex, appBtc) {
    const inputScripts = tx.ins.map((input, index) => {
      if (index !== signInputIndex) {
        return input.script.toString('hex')
      } else {
        return null
      }
    })

    const inputsPromises = tx.ins.map((input, index) => {
      const txId = Buffer.from(input.hash).reverse().toString('hex')
      const outputN = input.index
      const redeemScript = (index === signInputIndex) ? this.redeemScript.toString('hex') : undefined
      return getTransaction(txId)
        .then((transaction) => appBtc.splitTransaction(transaction))
        .then((preparedTx) => ([ preparedTx, outputN, redeemScript, input.sequence ]))
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
      .then((signaturesHex) => {
        if (signaturesHex.length !== 1) {
          throw new Error(`Unexpected number of signatures (${signaturesHex.length} > 1)`)
        }
        return this.getPublicKey()
          .then((publicKey) => {
            // god of abstraction, forgive me, for I have transgressed
            // add an '01' to convince btcjs to decompile our DER signature
            const sigBuffer = Buffer.from(signaturesHex[0] + '01', 'hex')
            const decompiled = btc.script.signature.decode(sigBuffer)
            const signer = new MockKeyPair(decompiled.signature, publicKey)
            txB.sign(signInputIndex, signer, this.redeemScript)
          })
      })
  }

  signTransactionSkeleton(tx, signInputIndex) {
    return this.obtainAppInterface()
      .then((appBtc) => this.prepareTransactionInfo(tx, signInputIndex, appBtc)
            .then((txInfo) => {
              return appBtc.signP2SHTransaction(
                txInfo.inputs,
                txInfo.signPaths,
                txInfo.outputHex,
                txInfo.lockTime,
                txInfo.sigHashType,
                false,
                1)
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
