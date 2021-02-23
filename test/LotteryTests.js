const { assert } = require("chai");
const truffleAssert = require("truffle-assertions");
const LotteryContract = artifacts.require("LotteryContract.sol");
const RandomnessContract = artifacts.require("MockRandomnessContract.sol");
const LinkTokenInterface = artifacts.require("LinkTokenInterface");
const { LinkToken } = require("@chainlink/contracts/truffle/v0.4/LinkToken");

contract("LotteryContract", (accounts) => {
  const BN = web3.utils.BN;
  const toBN = web3.utils.toBN;
  let lotteryContract;
  let randomnessContract;

  let bettingPrice = 0;

  let n1 = 0;
  let n2 = 0;
  let n3 = 0;
  let n4 = 0;

  const OPEN = 0;
  const CLOSED = 1;

  const getRandomNumber = () => {
    return Math.floor(Math.random() * 10);
  };

  const getRandomAccount = () => {
    return accounts[getRandomNumber()];
  };

  // before is Mocha's version of beforeAll
  before(async () => {
    randomnessContract = await RandomnessContract.deployed();
    lotteryContract = await LotteryContract.deployed();

    const token = await LinkTokenInterface.at(LinkToken.address);
    await token.transfer(randomnessContract.address, "1000000000000000000");

    bettingPrice = parseInt(await lotteryContract.bettingPrice(), 10);
  });

  beforeEach(async () => {
    n1 = getRandomNumber();
    n2 = getRandomNumber();
    n3 = getRandomNumber();
    n4 = getRandomNumber();
  });

  afterEach(async () => {
    const gameState = parseInt(await lotteryContract.gameState(), 10);
    if (gameState == OPEN) {
      await lotteryContract.drawNumbers(123456789);
    }
  });

  describe("deployment", async () => {
    it("deploys successfully", async () => {
      const address = await lotteryContract.address;

      assert.notEqual(address, 0x0);
      assert.notEqual(address, "");
      assert.notEqual(address, null);
      assert.notEqual(address, undefined);
    });

    it("currentGameId", async () => {
      const currentGameId = await lotteryContract.currentGameId();
      assert.equal(currentGameId, 1);
    });
  });

  describe("startGame", async () => {
    it("requires that no games are currently running", async () => {
      // Arrange
      await lotteryContract.startGame();
      const gameState = parseInt(await lotteryContract.gameState(), 10);
      assert.equal(gameState, OPEN);

      // Act and Assert
      await truffleAssert.reverts(lotteryContract.startGame(), "There is an active game already");
    });

    it("requires that only the admin can start a game", async () => {
      await truffleAssert.reverts(
        lotteryContract.startGame.call({ from: accounts[1] }),
        "Only admin has access to this resource"
      );
    });

    it("sets activeGame to true", async () => {
      const gameState = parseInt(await lotteryContract.gameState(), 10);
      assert.equal(gameState, CLOSED);

      await lotteryContract.startGame();

      const updatedGameState = parseInt(await lotteryContract.gameState(), 10);
      assert.equal(updatedGameState, OPEN);
    });

    it("sets currentGameId + 1", async () => {
      const currentGameId = parseInt(await lotteryContract.currentGameId(), 10);

      await lotteryContract.startGame();

      const updatedCurrentGameId = await lotteryContract.currentGameId();

      assert.equal(updatedCurrentGameId, currentGameId + 1);
    });

    it("adds new Game to games mapping", async () => {
      // Arrange
      const currentGameId = parseInt(await lotteryContract.currentGameId(), 10);
      const game = await lotteryContract.games(currentGameId);
      assert.equal(game.id, currentGameId);

      // Act
      await lotteryContract.startGame();

      // Assert
      const updatedCurrentGameId = parseInt(await lotteryContract.currentGameId(), 10);
      const newGame = await lotteryContract.games(updatedCurrentGameId);

      assert.equal(newGame.id, updatedCurrentGameId);
      assert.equal(newGame.randomNumber, 0);
      assert.equal(newGame.totalBetAmount, 0);
    });
  });

  describe("placeBet", async () => {
    beforeEach(async () => {
      await lotteryContract.startGame();
    });

    it("requires that there is an active game", async () => {
      await lotteryContract.drawNumbers(123456789);

      await await truffleAssert.reverts(
        lotteryContract.placeBet(n1, n2, n3, n4, { from: getRandomAccount(), value: bettingPrice }),
        "There are no active games accepting bets"
      );
    });

    it("requires valid betting numbers", async () => {
      await truffleAssert.reverts(
        lotteryContract.placeBet(10, n2, n3, n4, { from: getRandomAccount(), value: bettingPrice }),
        "First digit must be less than 10"
      );
      await truffleAssert.reverts(
        lotteryContract.placeBet(n1, 12, n3, n4, { from: getRandomAccount(), value: bettingPrice }),
        "Second digit must be less than 10"
      );
      await truffleAssert.reverts(
        lotteryContract.placeBet(n1, n2, 13, n4, { from: getRandomAccount(), value: bettingPrice }),
        "Third digit must be less than 10"
      );
      await truffleAssert.reverts(
        lotteryContract.placeBet(n1, n2, n3, 14, { from: getRandomAccount(), value: bettingPrice }),
        "Fourth digit must be less than 10"
      );

      await lotteryContract.placeBet(n1, n2, n3, n4, { from: getRandomAccount(), value: bettingPrice });
    });

    it("requires valid betting payment", async () => {
      await truffleAssert.reverts(
        lotteryContract.placeBet(n1, n2, n3, n4, { from: getRandomAccount(), value: 99 }),
        "Invalid betting price"
      );

      await truffleAssert.reverts(
        lotteryContract.placeBet(n1, n2, n3, n4, { from: getRandomAccount(), value: 101 }),
        "Invalid betting price"
      );

      await lotteryContract.placeBet(n1, n2, n3, n4, { from: getRandomAccount(), value: bettingPrice });
    });

    it("adds betting payment to total bet amount for the game", async () => {
      const currentGameId = parseInt(await lotteryContract.currentGameId(), 10);
      let game = await lotteryContract.games(currentGameId);
      let totalBetAmount = parseInt(game.totalBetAmount, 10);

      assert.equal(totalBetAmount, 0);

      await lotteryContract.placeBet(n1, n2, n3, n4, { from: accounts[2], value: bettingPrice });

      game = await lotteryContract.games(currentGameId);
      totalBetAmount = parseInt(game.totalBetAmount, 10);

      assert.equal(totalBetAmount, parseInt(bettingPrice, 10));

      await lotteryContract.placeBet(n1, n2, n3, n4, { from: accounts[3], value: bettingPrice });

      game = await lotteryContract.games(currentGameId);
      totalBetAmount = parseInt(game.totalBetAmount, 10);

      assert.equal(totalBetAmount, parseInt(bettingPrice, 10) * 2);
    });

    it("saves the bet correctly", async () => {
      const randomAccount = getRandomAccount();
      const currentGameId = parseInt(await lotteryContract.currentGameId(), 10);
      await lotteryContract.placeBet(n1, n2, n3, n4, { from: randomAccount, value: bettingPrice });

      const bet = await lotteryContract.bets(0);

      assert.equal(bet.player, randomAccount);
      assert.equal(parseInt(bet.bettingAmount, 10), parseInt(bettingPrice, 10));
      assert.equal(parseInt(bet.gameId, 10), currentGameId);
      assert.equal(bet.bettingNumbers.length, 4);
      assert.equal(parseInt(bet.bettingNumbers[0], 10), n1);
      assert.equal(parseInt(bet.bettingNumbers[1], 10), n2);
      assert.equal(parseInt(bet.bettingNumbers[2], 10), n3);
      assert.equal(parseInt(bet.bettingNumbers[3], 10), n4);
    });
  });

  describe("drawNumbers", async () => {
    it("requires that only the admin can draw the numbers", async () => {
      await truffleAssert.reverts(
        lotteryContract.drawNumbers(123456789, { from: accounts[1] }),
        "Only admin has access to this resource"
      );
    });

    it("requires that there is an active game", async () => {
      await truffleAssert.reverts(lotteryContract.drawNumbers(123456789), "There are no active games accepting bets");
    });

    it("Four numbers should be drawn correctly", async () => {
      const randomNumber = 123456789;
      await lotteryContract.startGame();

      // drawNumbers method actually takes a seed that is used to build the random number,
      // but for simplicity of this test (mocks, etc), we will use it as the drawn number
      await lotteryContract.drawNumbers(randomNumber);

      const currentGameId = parseInt(await lotteryContract.currentGameId(), 10);

      const game = await lotteryContract.games(currentGameId);

      assert.equal(parseInt(game.randomNumber, 10), randomNumber);
      assert.equal(parseInt(game.drawnNumbers.n1, 10), 6);
      assert.equal(parseInt(game.drawnNumbers.n2, 10), 7);
      assert.equal(parseInt(game.drawnNumbers.n3, 10), 8);
      assert.equal(parseInt(game.drawnNumbers.n4, 10), 9);
    });
  });

  describe("payoutPrizes", async () => {
    beforeEach(async () => {
      await lotteryContract.startGame();
    });

    it("should pay prizes correctly: 10 players, 7 winners", async () => {
      // Arrange
      const totalPlayers = 10;
      const totalWinners = 7;

      const totalBetAmount = totalPlayers * bettingPrice;
      const profit = (totalBetAmount * 10) / 100; // 10%
      const payablePrize = totalBetAmount - profit;
      const individualPayablePrize = Math.trunc(payablePrize / totalWinners);

      const randomNumber = 123456789;
      const initialContractBalance = new BN(await lotteryContract.getBalance());

      const initialAccount0Balance = new BN(await web3.eth.getBalance(accounts[0]));
      const initialAccount1Balance = new BN(await web3.eth.getBalance(accounts[1]));
      const initialAccount2Balance = new BN(await web3.eth.getBalance(accounts[2]));
      const initialAccount3Balance = new BN(await web3.eth.getBalance(accounts[3]));
      const initialAccount4Balance = new BN(await web3.eth.getBalance(accounts[4]));
      const initialAccount5Balance = new BN(await web3.eth.getBalance(accounts[5]));
      const initialAccount6Balance = new BN(await web3.eth.getBalance(accounts[6]));
      const initialAccount7Balance = new BN(await web3.eth.getBalance(accounts[7]));
      const initialAccount8Balance = new BN(await web3.eth.getBalance(accounts[8]));
      const initialAccount9Balance = new BN(await web3.eth.getBalance(accounts[9]));

      // account[0] is a winner
      const txInfo0 = await lotteryContract.placeBet(6, 7, 8, 9, { from: accounts[0], value: bettingPrice });

      // account[1] is not a winner
      const txInfo1 = await lotteryContract.placeBet(9, 8, 7, 6, { from: accounts[1], value: bettingPrice });

      // account[2] is a winner
      const txInfo2 = await lotteryContract.placeBet(6, 7, 8, 9, { from: accounts[2], value: bettingPrice });

      // account[3] is not a winner
      const txInfo3 = await lotteryContract.placeBet(0, 0, 1, 4, { from: accounts[3], value: bettingPrice });

      // account[4] is a winner
      const txInfo4 = await lotteryContract.placeBet(6, 7, 8, 9, { from: accounts[4], value: bettingPrice });

      // account[5] is a winner
      const txInfo5 = await lotteryContract.placeBet(6, 7, 8, 9, { from: accounts[5], value: bettingPrice });

      // account[6] is a winner
      const txInfo6 = await lotteryContract.placeBet(6, 7, 8, 9, { from: accounts[6], value: bettingPrice });

      // account[7] is a winner
      const txInfo7 = await lotteryContract.placeBet(6, 7, 8, 9, { from: accounts[7], value: bettingPrice });

      // account[8] is a winner
      const txInfo8 = await lotteryContract.placeBet(6, 7, 8, 9, { from: accounts[8], value: bettingPrice });

      // account[9] is not a winner
      const txInfo9 = await lotteryContract.placeBet(6, 7, 8, 7, { from: accounts[9], value: bettingPrice });

      // Act
      const txInfoDrawNumbers = await lotteryContract.drawNumbers(randomNumber);

      // Assert
      const updatedContractBalance = new BN(await lotteryContract.getBalance());
      const updatedAccount0Balance = new BN(await web3.eth.getBalance(accounts[0]));
      const updatedAccount1Balance = new BN(await web3.eth.getBalance(accounts[1]));
      const updatedAccount2Balance = new BN(await web3.eth.getBalance(accounts[2]));
      const updatedAccount3Balance = new BN(await web3.eth.getBalance(accounts[3]));
      const updatedAccount4Balance = new BN(await web3.eth.getBalance(accounts[4]));
      const updatedAccount5Balance = new BN(await web3.eth.getBalance(accounts[5]));
      const updatedAccount6Balance = new BN(await web3.eth.getBalance(accounts[6]));
      const updatedAccount7Balance = new BN(await web3.eth.getBalance(accounts[7]));
      const updatedAccount8Balance = new BN(await web3.eth.getBalance(accounts[8]));
      const updatedAccount9Balance = new BN(await web3.eth.getBalance(accounts[9]));

      // initial balance + profit + the decimal difference as Solidity currently only works with integer part of numbers
      const expectedContractBalance = initialContractBalance
        .add(toBN(profit))
        .add(toBN(payablePrize).mod(toBN(totalWinners)));
      assert.equal(updatedContractBalance.toString(), expectedContractBalance.toString());

      // account 0 (winner). Note: account 0 is the contract owner who also paid gas to draw the numbers
      const gasPrice0 = (await web3.eth.getTransaction(txInfo0.tx)).gasPrice;
      const gasCost0 = toBN(gasPrice0).mul(toBN(txInfo0.receipt.gasUsed));
      const gasPriceDrawNumbers = (await web3.eth.getTransaction(txInfoDrawNumbers.tx)).gasPrice;
      const gasCostDrawnNumbers = toBN(gasPriceDrawNumbers).mul(toBN(txInfoDrawNumbers.receipt.gasUsed));
      const expectedAccount0Balance = initialAccount0Balance
        .sub(toBN(bettingPrice))
        .sub(gasCost0)
        .sub(gasCostDrawnNumbers)
        .add(toBN(individualPayablePrize));
      assert.equal(updatedAccount0Balance.toString(), expectedAccount0Balance.toString());

      // account 1
      const gasPrice1 = (await web3.eth.getTransaction(txInfo1.tx)).gasPrice;
      const gasCost1 = toBN(gasPrice1).mul(toBN(txInfo1.receipt.gasUsed));
      const expectedAccount1Balance = initialAccount1Balance.sub(toBN(bettingPrice)).sub(gasCost1);
      assert.equal(updatedAccount1Balance.toString(), expectedAccount1Balance.toString());

      // account 2 (winner)
      const gasPrice2 = (await web3.eth.getTransaction(txInfo2.tx)).gasPrice;
      const gasCost2 = toBN(gasPrice2).mul(toBN(txInfo2.receipt.gasUsed));
      const expectedAccount2Balance = initialAccount2Balance
        .sub(toBN(bettingPrice))
        .sub(gasCost2)
        .add(toBN(individualPayablePrize));
      assert.equal(updatedAccount2Balance.toString(), expectedAccount2Balance.toString());

      // account 3
      const gasPrice3 = (await web3.eth.getTransaction(txInfo3.tx)).gasPrice;
      const gasCost3 = toBN(gasPrice3).mul(toBN(txInfo3.receipt.gasUsed));
      const expectedAccount3Balance = initialAccount3Balance.sub(toBN(bettingPrice)).sub(gasCost3);
      assert.equal(updatedAccount3Balance.toString(), expectedAccount3Balance.toString());

      // account 4 (winner)
      const gasPrice4 = (await web3.eth.getTransaction(txInfo4.tx)).gasPrice;
      const gasCost4 = toBN(gasPrice4).mul(toBN(txInfo4.receipt.gasUsed));
      const expectedAccount4Balance = initialAccount4Balance
        .sub(toBN(bettingPrice))
        .sub(gasCost4)
        .add(toBN(individualPayablePrize));
      assert.equal(updatedAccount4Balance.toString(), expectedAccount4Balance.toString());

      // account 5 (winner)
      const gasPrice5 = (await web3.eth.getTransaction(txInfo5.tx)).gasPrice;
      const gasCost5 = toBN(gasPrice5).mul(toBN(txInfo5.receipt.gasUsed));
      const expectedAccount5Balance = initialAccount5Balance
        .sub(toBN(bettingPrice))
        .sub(gasCost5)
        .add(toBN(individualPayablePrize));
      assert.equal(updatedAccount5Balance.toString(), expectedAccount5Balance.toString());

      // account 6 (winner)
      const gasPrice6 = (await web3.eth.getTransaction(txInfo6.tx)).gasPrice;
      const gasCost6 = toBN(gasPrice6).mul(toBN(txInfo6.receipt.gasUsed));
      const expectedAccount6Balance = initialAccount6Balance
        .sub(toBN(bettingPrice))
        .sub(gasCost6)
        .add(toBN(individualPayablePrize));
      assert.equal(updatedAccount6Balance.toString(), expectedAccount6Balance.toString());

      // account 7 (winner)
      const gasPrice7 = (await web3.eth.getTransaction(txInfo7.tx)).gasPrice;
      const gasCost7 = toBN(gasPrice7).mul(toBN(txInfo7.receipt.gasUsed));
      const expectedAccount7Balance = initialAccount7Balance
        .sub(toBN(bettingPrice))
        .sub(gasCost7)
        .add(toBN(individualPayablePrize));
      assert.equal(updatedAccount7Balance.toString(), expectedAccount7Balance.toString());

      // account 8 (winner)
      const gasPrice8 = (await web3.eth.getTransaction(txInfo8.tx)).gasPrice;
      const gasCost8 = toBN(gasPrice8).mul(toBN(txInfo8.receipt.gasUsed));
      const expectedAccount8Balance = initialAccount8Balance
        .sub(toBN(bettingPrice))
        .sub(gasCost8)
        .add(toBN(individualPayablePrize));
      assert.equal(updatedAccount8Balance.toString(), expectedAccount8Balance.toString());

      // account 9
      const gasPrice9 = (await web3.eth.getTransaction(txInfo9.tx)).gasPrice;
      const gasCost9 = toBN(gasPrice9).mul(toBN(txInfo9.receipt.gasUsed));
      const expectedAccount9Balance = initialAccount9Balance.sub(toBN(bettingPrice)).sub(gasCost9);
      assert.equal(updatedAccount9Balance.toString(), expectedAccount9Balance.toString());
    });

    it("should pay prizes correctly: 7 players, 1 winner", async () => {
      // Arrange
      const totalPlayers = 7;
      const totalWinners = 1;

      const totalBetAmount = totalPlayers * bettingPrice;
      const profit = (totalBetAmount * 10) / 100; // 10%
      const payablePrize = totalBetAmount - profit;
      const individualPayablePrize = Math.trunc(payablePrize / totalWinners);

      const randomNumber = 123456789;
      const initialContractBalance = new BN(await lotteryContract.getBalance());

      const initialAccount1Balance = new BN(await web3.eth.getBalance(accounts[1]));
      const initialAccount2Balance = new BN(await web3.eth.getBalance(accounts[2]));
      const initialAccount3Balance = new BN(await web3.eth.getBalance(accounts[3]));
      const initialAccount4Balance = new BN(await web3.eth.getBalance(accounts[4]));
      const initialAccount5Balance = new BN(await web3.eth.getBalance(accounts[5]));
      const initialAccount6Balance = new BN(await web3.eth.getBalance(accounts[6]));
      const initialAccount7Balance = new BN(await web3.eth.getBalance(accounts[7]));

      // account[1] is not a winner
      const txInfo1 = await lotteryContract.placeBet(9, 5, 7, 6, { from: accounts[1], value: bettingPrice });

      // account[2] is not a winner
      const txInfo2 = await lotteryContract.placeBet(6, 7, 8, 7, { from: accounts[2], value: bettingPrice });

      // account[3] is not a winner
      const txInfo3 = await lotteryContract.placeBet(0, 0, 1, 4, { from: accounts[3], value: bettingPrice });

      // account[4] is not a winner
      const txInfo4 = await lotteryContract.placeBet(1, 7, 8, 9, { from: accounts[4], value: bettingPrice });

      // account[5] is not a winner
      const txInfo5 = await lotteryContract.placeBet(0, 7, 8, 9, { from: accounts[5], value: bettingPrice });

      // account[6] is not a winner
      const txInfo6 = await lotteryContract.placeBet(6, 5, 8, 9, { from: accounts[6], value: bettingPrice });

      // account[7] is a winner
      const txInfo7 = await lotteryContract.placeBet(6, 7, 8, 9, { from: accounts[7], value: bettingPrice });

      // Act
      const txInfoDrawNumbers = await lotteryContract.drawNumbers(randomNumber);

      // Assert
      const updatedContractBalance = new BN(await lotteryContract.getBalance());
      const updatedAccount1Balance = new BN(await web3.eth.getBalance(accounts[1]));
      const updatedAccount2Balance = new BN(await web3.eth.getBalance(accounts[2]));
      const updatedAccount3Balance = new BN(await web3.eth.getBalance(accounts[3]));
      const updatedAccount4Balance = new BN(await web3.eth.getBalance(accounts[4]));
      const updatedAccount5Balance = new BN(await web3.eth.getBalance(accounts[5]));
      const updatedAccount6Balance = new BN(await web3.eth.getBalance(accounts[6]));
      const updatedAccount7Balance = new BN(await web3.eth.getBalance(accounts[7]));

      // initial balance + profit + the decimal difference as Solidity currently only works with integer part of numbers
      const expectedContractBalance = initialContractBalance
        .add(toBN(profit))
        .add(toBN(payablePrize).mod(toBN(totalWinners)));
      assert.equal(updatedContractBalance.toString(), expectedContractBalance.toString());

      // account 1
      const gasPrice1 = (await web3.eth.getTransaction(txInfo1.tx)).gasPrice;
      const gasCost1 = toBN(gasPrice1).mul(toBN(txInfo1.receipt.gasUsed));
      const expectedAccount1Balance = initialAccount1Balance.sub(toBN(bettingPrice)).sub(gasCost1);
      assert.equal(updatedAccount1Balance.toString(), expectedAccount1Balance.toString());

      // account 2
      const gasPrice2 = (await web3.eth.getTransaction(txInfo2.tx)).gasPrice;
      const gasCost2 = toBN(gasPrice2).mul(toBN(txInfo2.receipt.gasUsed));
      const expectedAccount2Balance = initialAccount2Balance.sub(toBN(bettingPrice)).sub(gasCost2);
      assert.equal(updatedAccount2Balance.toString(), expectedAccount2Balance.toString());

      // account 3
      const gasPrice3 = (await web3.eth.getTransaction(txInfo3.tx)).gasPrice;
      const gasCost3 = toBN(gasPrice3).mul(toBN(txInfo3.receipt.gasUsed));
      const expectedAccount3Balance = initialAccount3Balance.sub(toBN(bettingPrice)).sub(gasCost3);
      assert.equal(updatedAccount3Balance.toString(), expectedAccount3Balance.toString());

      // account 4
      const gasPrice4 = (await web3.eth.getTransaction(txInfo4.tx)).gasPrice;
      const gasCost4 = toBN(gasPrice4).mul(toBN(txInfo4.receipt.gasUsed));
      const expectedAccount4Balance = initialAccount4Balance.sub(toBN(bettingPrice)).sub(gasCost4);
      assert.equal(updatedAccount4Balance.toString(), expectedAccount4Balance.toString());

      // account 5
      const gasPrice5 = (await web3.eth.getTransaction(txInfo5.tx)).gasPrice;
      const gasCost5 = toBN(gasPrice5).mul(toBN(txInfo5.receipt.gasUsed));
      const expectedAccount5Balance = initialAccount5Balance.sub(toBN(bettingPrice)).sub(gasCost5);
      assert.equal(updatedAccount5Balance.toString(), expectedAccount5Balance.toString());

      // account 6
      const gasPrice6 = (await web3.eth.getTransaction(txInfo6.tx)).gasPrice;
      const gasCost6 = toBN(gasPrice6).mul(toBN(txInfo6.receipt.gasUsed));
      const expectedAccount6Balance = initialAccount6Balance.sub(toBN(bettingPrice)).sub(gasCost6);
      assert.equal(updatedAccount6Balance.toString(), expectedAccount6Balance.toString());

      // account 7 (winner)
      const gasPrice7 = (await web3.eth.getTransaction(txInfo7.tx)).gasPrice;
      const gasCost7 = toBN(gasPrice7).mul(toBN(txInfo7.receipt.gasUsed));
      const expectedAccount7Balance = initialAccount7Balance
        .sub(toBN(bettingPrice))
        .sub(gasCost7)
        .add(toBN(individualPayablePrize));
      assert.equal(updatedAccount7Balance.toString(), expectedAccount7Balance.toString());
    });

    it("should not pay prizes when there are no winners: 5 players", async () => {
      // Arrange
      const totalPlayers = 5;

      const randomNumber = 123456789;

      const initialContractBalance = new BN(await lotteryContract.getBalance());

      const initialAccount1Balance = new BN(await web3.eth.getBalance(accounts[1]));
      const initialAccount2Balance = new BN(await web3.eth.getBalance(accounts[2]));
      const initialAccount3Balance = new BN(await web3.eth.getBalance(accounts[3]));
      const initialAccount4Balance = new BN(await web3.eth.getBalance(accounts[4]));
      const initialAccount5Balance = new BN(await web3.eth.getBalance(accounts[5]));

      // account[1] is not a winner
      const txInfo1 = await lotteryContract.placeBet(9, 8, 7, 6, { from: accounts[1], value: bettingPrice });

      // account[2] is not a winner
      const txInfo2 = await lotteryContract.placeBet(6, 7, 7, 9, { from: accounts[2], value: bettingPrice });

      // account[3] is not a winner
      const txInfo3 = await lotteryContract.placeBet(0, 0, 1, 4, { from: accounts[3], value: bettingPrice });

      // account[4] not is a winner
      const txInfo4 = await lotteryContract.placeBet(7, 7, 8, 9, { from: accounts[4], value: bettingPrice });

      // account[5] is not a winner
      const txInfo5 = await lotteryContract.placeBet(6, 7, 8, 0, { from: accounts[5], value: bettingPrice });

      // Act
      await lotteryContract.drawNumbers(randomNumber);

      // Assert
      const updatedContractBalance = new BN(await lotteryContract.getBalance());

      const updatedAccount1Balance = new BN(await web3.eth.getBalance(accounts[1]));
      const updatedAccount2Balance = new BN(await web3.eth.getBalance(accounts[2]));
      const updatedAccount3Balance = new BN(await web3.eth.getBalance(accounts[3]));
      const updatedAccount4Balance = new BN(await web3.eth.getBalance(accounts[4]));
      const updatedAccount5Balance = new BN(await web3.eth.getBalance(accounts[5]));

      const profit = totalPlayers * bettingPrice;
      assert.equal(updatedContractBalance.toString(), initialContractBalance.add(toBN(profit)).toString());

      // account 1
      const gasPrice1 = (await web3.eth.getTransaction(txInfo1.tx)).gasPrice;
      const gasCost1 = toBN(gasPrice1).mul(toBN(txInfo1.receipt.gasUsed));
      const expectedAccount1Balance = initialAccount1Balance.sub(toBN(bettingPrice)).sub(gasCost1);
      assert.equal(updatedAccount1Balance.toString(), expectedAccount1Balance.toString());

      // account 2
      const gasPrice2 = (await web3.eth.getTransaction(txInfo2.tx)).gasPrice;
      const gasCost2 = toBN(gasPrice2).mul(toBN(txInfo2.receipt.gasUsed));
      const expectedAccount2Balance = initialAccount2Balance.sub(toBN(bettingPrice)).sub(gasCost2);
      assert.equal(updatedAccount2Balance.toString(), expectedAccount2Balance.toString());

      // account 3
      const gasPrice3 = (await web3.eth.getTransaction(txInfo3.tx)).gasPrice;
      const gasCost3 = toBN(gasPrice3).mul(toBN(txInfo3.receipt.gasUsed));
      const expectedAccount3Balance = initialAccount3Balance.sub(toBN(bettingPrice)).sub(gasCost3);
      assert.equal(updatedAccount3Balance.toString(), expectedAccount3Balance.toString());

      // account 4
      const gasPrice4 = (await web3.eth.getTransaction(txInfo4.tx)).gasPrice;
      const gasCost4 = toBN(gasPrice4).mul(toBN(txInfo4.receipt.gasUsed));
      const expectedAccount4Balance = initialAccount4Balance.sub(toBN(bettingPrice)).sub(gasCost4);
      assert.equal(updatedAccount4Balance.toString(), expectedAccount4Balance.toString());

      // account 5
      const gasPrice5 = (await web3.eth.getTransaction(txInfo5.tx)).gasPrice;
      const gasCost5 = toBN(gasPrice5).mul(toBN(txInfo5.receipt.gasUsed));
      const expectedAccount5Balance = initialAccount5Balance.sub(toBN(bettingPrice)).sub(gasCost5);
      assert.equal(updatedAccount5Balance.toString(), expectedAccount5Balance.toString());
    });
  });

  describe("endGame", async () => {
    it("game should get closed correctly", async () => {
      await lotteryContract.startGame();
      await lotteryContract.drawNumbers(123456789);

      const gameState = parseInt(await lotteryContract.gameState(), 10);

      assert.equal(gameState, CLOSED);
    });
  });
});
