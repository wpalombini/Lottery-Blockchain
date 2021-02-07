const { assert } = require("chai");
const truffleAssert = require("truffle-assertions");
const LotteryContract = artifacts.require("LotteryContract.sol");

contract("LotteryContract", (accounts) => {
  let lotteryContract;

  beforeEach(async () => {
    lotteryContract = await LotteryContract.deployed();
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

      // clean up
      await lotteryContract.endGame();
    });

    it("requires that only the admin can start a game", async () => {
      await truffleAssert.reverts(lotteryContract.startGame.call({ from: accounts[1] }), "Only admin has access to this resource");
    });

    // cannot mock activeGame. Needed to change it to true to assert bet array is empty
    // it("requires that there are no outstanding bets", async () => {
    //   // Arrange
    //   await lotteryContract.startGame();
    //   await lotteryContract.placeBet.call(1, 2, 3, 4, { from: accounts[1], value: 100 });

    //   await lotteryContract.activeGame();

    //   await truffleAssert.reverts(lotteryContract.startGame.call({ from: accounts[0] }), "There are outstanding bets");
    // });

    it("sets activeGame to true", async () => {
      const activeGame = await lotteryContract.activeGame();
      assert.equal(activeGame, false);

      await lotteryContract.startGame();

      const updatedActiveGame = await lotteryContract.activeGame();
      assert.equal(updatedActiveGame, true);

      // clean up
      await lotteryContract.endGame();
    });

    it("sets currentGameId + 1", async () => {
      const currentGameId = parseInt(await lotteryContract.currentGameId());

      await lotteryContract.startGame();

      const updatedCurrentGameId = await lotteryContract.currentGameId();

      assert.equal(updatedCurrentGameId, currentGameId + 1);

      // clean up
      await lotteryContract.endGame();
    });

    it("adds new Game to games mapping", async () => {
      const currentGameId = parseInt(await lotteryContract.currentGameId());

      const game = await lotteryContract.games.call(currentGameId);

      assert.equal(game.id, currentGameId);
      assert.equal(game.randomNumber, 0);
      assert.equal(game.totalBetAmount, 0);

      await lotteryContract.startGame();

      const updatedCurrentGameId = parseInt(await lotteryContract.currentGameId());

      const newGame = await lotteryContract.games.call(updatedCurrentGameId);

      assert.equal(newGame.id, updatedCurrentGameId);
      assert.equal(newGame.randomNumber, 0);
      assert.equal(newGame.totalBetAmount, 0);

      // clean up
      await lotteryContract.endGame();
    });
  });
});
