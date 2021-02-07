const lotteryContract = artifacts.require("LotteryContract");

module.exports = function (deployer) {
  deployer.deploy(lotteryContract);
};
