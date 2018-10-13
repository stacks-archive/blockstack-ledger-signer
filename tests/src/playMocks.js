import { runTests } from './units'

import fs from 'fs'

import TransportHid from '@ledgerhq/hw-transport-node-hid'
import {
  createTransportReplayer,
  RecordStore
} from '@ledgerhq/hw-transport-mocker'

const records = {}

const snapshots = JSON.parse(fs.readFileSync('/tmp/blockstack-ledger-js-test-snapshots', 'utf8'))

async function main() {
  runTests((testName) => {
    const recordStore = new RecordStore()
    if (!(testName in snapshots)) {
      throw new Error("Test called '" + testName + "' doesnt exists in snapshot.")
    }
    return createTransportReplayer(RecordStore.fromObject(snapshots[testName]))
  })
    .then(
      () => {
        console.log("ALL PASS!")
      },
      e => {
        console.log(e)
        process.exit(1)
      })
}


main()
