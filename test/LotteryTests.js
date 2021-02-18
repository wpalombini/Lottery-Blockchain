const { assert } = require("chai");
const truffleAssert = require("truffle-assertions");
const LotteryContract = artifacts.require("LotteryContract.sol");
const RandomnessContract = artifacts.require("MockRandomnessContract.sol");
const LinkTokenInterface = artifacts.require("LinkTokenInterface");
const { LinkToken } = require("@chainlink/contracts/truffle/v0.4/LinkToken");

contract("LotteryContract", (accounts) => {
  let lotteryContract;
  let randomnessContract;

  let bettingPrice = 0;

  let n1 = 0;
  let n2 = 0;
  let n3 = 0;
  let n4 = 0;

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

    bettingPrice = await lotteryContract.bettingPrice();
  });

  beforeEach(async () => {
    n1 = getRandomNumber();
    n2 = getRandomNumber();
    n3 = getRandomNumber();
    n4 = getRandomNumber();
  });

  afterEach(async () => {
    const activeGame = await lotteryContract.activeGame();
    if (activeGame) {
      await lotteryContract.drawNumbers(123456789);
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
      await lotteryContract.endGame();

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

  describe("payoutPrizes", async () => {});

  describe("endGame", async () => {
    it("requires that only the admin can end a game", async () => {
      await lotteryContract.startGame();

      await truffleAssert.reverts(
        lotteryContract.endGame.call({ from: accounts[1] }),
        "Only admin has access to this resource"
      );
    });

    it("requires that there is an active game", async () => {
      await truffleAssert.reverts(
        lotteryContract.endGame.call({ from: accounts[0] }),
        "There are no active games accepting bets"
      );
    });

    it("requires that there are no outstanding bets", async () => {
      await lotteryContract.startGame();
      await lotteryContract.placeBet(n1, n2, n3, n4, { from: getRandomAccount(), value: bettingPrice });

      await truffleAssert.reverts(lotteryContract.endGame.call({ from: accounts[0] }), "There are outstanding bets");
    });
  });
});
