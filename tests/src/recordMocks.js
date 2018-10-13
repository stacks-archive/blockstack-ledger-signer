import { runTests } from './units'

import fs from 'fs'

import TransportHid from '@ledgerhq/hw-transport-node-hid'
import {
  createTransportRecorder,
  RecordStore
} from '@ledgerhq/hw-transport-mocker'

const records = {}

async function main() {
  runTests((testName) => {
    const recordStore = new RecordStore()
    if (testName in records) {
      throw new Error("Test called '" + testName + "' already exists.")
    }
    records[testName] = recordStore
    return createTransportRecorder(TransportHid, recordStore)
  })
    .then(
      () => {
        console.log("ALL PASS!")
        console.log("Recording snapshots...")
        const snapshots = {}
        for (let name in records) {
          snapshots[name] = records[name].toObject()
        }
        fs.writeFileSync(
          '/tmp/blockstack-ledger-js-test-snapshots',
          JSON.stringify(snapshots, null, 2)
        )
        console.log(          JSON.stringify(snapshots, null, 2) )
        console.log("done.")
      },
      e => {
        console.log(e)
        process.exit(1)
      })
}


main()
