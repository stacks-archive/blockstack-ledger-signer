## Usage

This package implements the `TransactionSigner` interface from blockstack.js
using Ledger's Bitcoin application.

This provides both single-sig and multi-sig signers.

To use:

```javascript
import { LedgerSigner } from 'blockstack-ledger'
import bsk from 'blockstack'
import Transport from '@ledgerhq/hw-transport-node-hid'

const signer = new LedgerSigner(`m/44'/88'/0'/0/1`, Transport)
bsk.makeTokenTransfer(recipientAddress, 'STACKS', BigInteger.fromHex('10'), '', signer)
    .then((signedTX) => ...)
```

## Building

This library, unfortunately, depends on a _fork_ of the Ledger Bitcoin API. This is because the original
API does not expose the ability to sign a subset of inputs in the transaction (e.g., if you want a transaction
to have three inputs, where only one of the inputs is signed by the Ledger, but the other inputs are signed by other
parties).

## Testing

Until I can figure out how to get the APDU mocking working correctly with ledgerjs, you'll need a device to
test with. That device should be initialized with this seed phrase:

```
taste wrap bright morning legend across favorite brother post umbrella cage erase
```

