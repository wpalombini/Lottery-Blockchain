const { assert } = require("chai");
const truffleAssert = require("truffle-assertions");
const LotteryContract = artifacts.require("LotteryContract.sol");

contract("LotteryContract", (accounts) => {
  let lotteryContract;

  beforeEach(async () => {
    lotteryContract = await LotteryContract.deployed();
  });

  afterEach(async () => {
    const activeGame = await lotteryContract.activeGame();
    if (activeGame) {
      await lotteryContract.endGame();
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
      const activeGame = await lotteryContract.activeGame();
      assert.equal(activeGame, true);

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
      const activeGame = await lotteryContract.activeGame();
      assert.equal(activeGame, false);

      await lotteryContract.startGame();

      const updatedActiveGame = await lotteryContract.activeGame();
      assert.equal(updatedActiveGame, true);
    });

    it("sets currentGameId + 1", async () => {
      const currentGameId = parseInt(await lotteryContract.currentGameId(), 10);

      await lotteryContract.startGame();

      const updatedCurrentGameId = await lotteryContract.currentGameId();

      assert.equal(updatedCurrentGameId, currentGameId + 1);
    });

    it("adds new Game to games mapping", async () => {
      const currentGameId = parseInt(await lotteryContract.currentGameId(), 10);

      const game = await lotteryContract.games.call(currentGameId);

      assert.equal(game.id, currentGameId);
      assert.equal(game.randomNumber, 0);
      assert.equal(game.totalBetAmount, 0);

      await lotteryContract.startGame();

      const updatedCurrentGameId = parseInt(await lotteryContract.currentGameId(), 10);

      const newGame = await lotteryContract.games.call(updatedCurrentGameId);

      assert.equal(newGame.id, updatedCurrentGameId);
      assert.equal(newGame.randomNumber, 0);
      assert.equal(newGame.totalBetAmount, 0);
    });
  });

  describe("placeBet", async () => {
    let bettingPrice = 0;

    let n1 = 0;
    let n2 = 0;
    let n3 = 0;
    let n4 = 0;

    // before is Mocha's version of beforeAll
    before(async () => {
      bettingPrice = await lotteryContract.bettingPrice();
    });

    beforeEach(async () => {
      n1 = Math.floor(Math.random() * 10);
      n2 = Math.floor(Math.random() * 10);
      n3 = Math.floor(Math.random() * 10);
      n4 = Math.floor(Math.random() * 10);

      await lotteryContract.startGame();
    });

    it("requires that there is an active game", async () => {
      await lotteryContract.endGame();

      await await truffleAssert.reverts(
        lotteryContract.placeBet(n1, n2, n3, n4, { from: accounts[1], value: bettingPrice }),
        "There are no active games accepting bets"
      );
    });

    it("requires valid betting numbers", async () => {
      await truffleAssert.reverts(
        lotteryContract.placeBet(10, n2, n3, n4, { from: accounts[1], value: bettingPrice }),
        "First digit must be less than 10"
      );
      await truffleAssert.reverts(
        lotteryContract.placeBet(n1, 12, n3, n4, { from: accounts[1], value: bettingPrice }),
        "Second digit must be less than 10"
      );
      await truffleAssert.reverts(
        lotteryContract.placeBet(n1, n2, 13, n4, { from: accounts[1], value: bettingPrice }),
        "Third digit must be less than 10"
      );
      await truffleAssert.reverts(
        lotteryContract.placeBet(n1, n2, n3, 14, { from: accounts[1], value: bettingPrice }),
        "Fourth digit must be less than 10"
      );

      await lotteryContract.placeBet(n1, n2, n3, n4, { from: accounts[1], value: bettingPrice });
    });

    it("requires valid betting payment", async () => {
      await truffleAssert.reverts(
        lotteryContract.placeBet(n1, n2, n3, n4, { from: accounts[2], value: 99 }),
        "Invalid betting price"
      );

      await truffleAssert.reverts(
        lotteryContract.placeBet(n1, n2, n3, n4, { from: accounts[2], value: 101 }),
        "Invalid betting price"
      );

      await lotteryContract.placeBet(n1, n2, n3, n4, { from: accounts[2], value: bettingPrice });
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
      const currentGameId = parseInt(await lotteryContract.currentGameId(), 10);
      await lotteryContract.placeBet(n1, n2, n3, n4, { from: accounts[4], value: bettingPrice });

      const bet = await lotteryContract.bets(0);

      assert.equal(bet.player, accounts[4]);
      assert.equal(parseInt(bet.bettingAmount, 10), parseInt(bettingPrice, 10));
      assert.equal(parseInt(bet.gameId, 10), currentGameId);
      assert.equal(bet.bettingNumbers.length, 4);
      assert.equal(parseInt(bet.bettingNumbers[0], 10), n1);
      assert.equal(parseInt(bet.bettingNumbers[1], 10), n2);
      assert.equal(parseInt(bet.bettingNumbers[2], 10), n3);
      assert.equal(parseInt(bet.bettingNumbers[3], 10), n4);
    });
  });

  describe("endGame", async () => {});
});
