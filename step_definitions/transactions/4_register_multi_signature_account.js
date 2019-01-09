const { getFixtureUser, BEDDOWS, GENESIS_ACCOUNT, from } = require('../../utils');

const I = actor();
let multisigAccount;
let params;
let contracts;

Then('{string}, {string} has a multisignature account with {string}', async (user1, user2, user3) => {
  const signer1 = getFixtureUser('username', user1);
  const signer2 = getFixtureUser('username', user2);
  const api = await I.call();

  multisigAccount = getFixtureUser('username', user3);
  contracts = [signer1, signer2];

  const account = await api.getMultisignatureGroups(multisigAccount.address);
  await I.expectMultisigAccountToHaveContracts(account, contracts);
});

Given('I have {int} lisk account with {int} LSK tokens', async (userCount, amount) => {
  const wallets = new Array(userCount).fill(0);
  contracts = await Promise.all(wallets.map(() => I.createAccount()));
  const transfers = contracts.map(a => ({ recipientId: a.address, amount: BEDDOWS(amount), passphrase: GENESIS_ACCOUNT.password }));

  const trxs = await I.transferToMultipleAccounts(transfers);
  await I.waitForBlock(trxs.length + 25);

  trxs.map(async (t) => {
    return await I.validateTransaction(t.id, t.recipientId, amount, GENESIS_ACCOUNT.address);
  });

  multisigAccount = contracts.pop();
});

When('I create a multisignature account with {int} accounts', async (count) => {
  params = {
    lifetime: 1,
    minimum: count,
    maximum: count,
    passphrase: multisigAccount.passphrase,
  };

  await I.registerMultisignature(contracts, params);
});

Then('I should be able to transact using multisignature account I created', async () => {
  const api = await I.call();
  const { address } = getFixtureUser('username', 'loki');
  const { passphrase } = multisigAccount;

  const transaction = await I.transfer({ recipientId: address, amount: BEDDOWS(1), passphrase });

  await I.sendSignaturesForMultisigTrx(transaction, contracts);

  await I.waitForTransactionToConfirm(transaction.id);

  const { result, error } = await from(api.getTransactions({
    id: transaction.id,
    senderId: multisigAccount.address,
    recipientId: address,
  }));

  expect(error).to.be.null;
  expect(result.data[0].id).to.deep.equal(transaction.id);
  expect(result.data[0].senderId).to.deep.equal(multisigAccount.address);
  expect(result.data[0].recipientId).to.deep.equal(address);
  expect(result.data[0].signatures).to.have.lengthOf(contracts.length);
});
