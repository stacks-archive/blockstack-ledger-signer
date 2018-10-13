import { runTests } from './units'

import fs from 'fs'

import TransportHid from '@ledgerhq/hw-transport-node-hid'

async function main() {
  runTests(() => TransportHid)
    .then(
      () => {
        console.log('Passed.')
      },
      e => {
        console.log(e)
        process.exit(1)
      })
}


main()
