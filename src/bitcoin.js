var bitcoin = require('bitcoinjs-lib');
var bigi = require('bigi');

function networkCheck(network) {
  return network === 'testnet' ? bitcoin.networks.testnet : null;
}

function getAddressFromWIF(wif, network) {
  network = networkCheck(network);
  var key = bitcoin.ECKey.fromWIF(wif);
  var address = key.pub.getAddress(network).toString();
  return address;
}

function buildTransaction(options, callback) {
  var key = getAddressFromWIF(options.sourceWIF, options.network);  //public key to send the change to
  var unspentOutputs = options.rawUnspentOutputs;
  var tx = new bitcoin.TransactionBuilder();
  var amountForDestinationInSatoshis = options.amountForDestination;
  var accumulatedValueInSatoshis = 0.0;  //counter to keep track of the balance of the unspents we have looked at.
  var notEnoughBTC = true;  //flag to set false if the unspents exceed the transaction amount + transaction fee.
  var numInputs = 0;        //counter of the number of inputs to the transaction to calculate transaction fee.
  var transactionFeeInSatoshis;
  
  for (var i = 0; i < unspentOutputs.length; i++) {
    var currentUnspentOutput = unspentOutputs[i];
    var txid = currentUnspentOutput.txid;
    var value = currentUnspentOutput.value;
    var vout = currentUnspentOutput.vout;

    tx.addInput(txid, vout);
    numInputs++;
    transactionFeeInSatoshis = (181 * numInputs + 34 * 2 + 10);
    accumulatedValueInSatoshis += value;

    if (accumulatedValueInSatoshis > (amountForDestinationInSatoshis + transactionFeeInSatoshis)) {
      var change = Math.floor(accumulatedValueInSatoshis - amountForDestinationInSatoshis - transactionFeeInSatoshis);
      //someone is sending money to themselves. Should this be allowed? Handling it for
      if (key === options.destinationAddress) {
        tx.addOutput(options.destinationAddress , amountForDestinationInSatoshis + change);  //ensure integer value
      } else {
        tx.addOutput(options.destinationAddress , amountForDestinationInSatoshis);
        tx.addOutput(key, change);
      }
      notEnoughBTC = false;
      break;
    }
  }
  
  if (notEnoughBTC) {
    callback("not enough in wallet to complete transaction", null);
  }
  else {
    //sign the transaction
    for (var i = 0; i < numInputs; i++) {
      tx.sign(i, bitcoin.ECKey.fromWIF(options.sourceWIF));
    }
    options.propagateCallback(tx.build().toHex(), callback);
  }
}

module.exports = {
  buildTransaction: buildTransaction,
  getAddressFromWIF: getAddressFromWIF
}
