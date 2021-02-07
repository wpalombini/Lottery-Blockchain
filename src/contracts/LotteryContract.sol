// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.7.0;

pragma experimental ABIEncoderV2;

import "@chainlink/contracts/contracts/v0.6/VRFConsumerBase.sol";

contract LotteryContract is VRFConsumerBase {
    
    bytes32 reqId;
    uint256 public randomNumber;
    
    bytes32 internal keyHash;
    uint256 internal fee;
    
    address payable admin;
    
    bool public activeGame;
    uint public currentGameId = 1;
    uint totalBets = 0;
    
    struct Game {
        uint id;
        uint randomNumber;
        uint totalBetAmount;
    }
    
    mapping (uint => Game) public games;
    
    struct Bet {
        uint id;
        address payable player;
        uint betAmount;
        uint gameId;
        BetNumbers betNumbers;
    }
    
    struct BetNumbers {
        uint8 n1;
        uint8 n2;
        uint8 n3;
        uint8 n4;
    }
    
    Bet[] public bets;
    
    struct DrawDetails {
        string message;
        uint drawnDateTime;
        uint randomNumber;
    }
    
    /**
     * Constructor inherits VRFConsumerBase
     * 
     * Network: Kovan
     * Chainlink VRF Coordinator address: 0xdD3782915140c8f3b190B5D67eAc6dc5760C46E9
     * LINK token address:                0xa36085F69e2889c224210F603D836748e7dC0088
     * Key Hash: 0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4
     */
    constructor()
        VRFConsumerBase(
            0xdD3782915140c8f3b190B5D67eAc6dc5760C46E9, // VRF Coordinator
            0xa36085F69e2889c224210F603D836748e7dC0088  // LINK Token
        ) public
    {
        keyHash = 0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4;
        fee = 0.1 * 10 ** 18; // 0.1 LINK
        admin = msg.sender;
    }
    
    modifier activeGameRequired() {
        require(activeGame == true, 'There are no active games accepting bets');
        require(games[currentGameId].id == currentGameId, 'cannot find game');
        _;
    }
    
    modifier adminRequired() {
        require(msg.sender == admin, 'Only admin has access to this resource');
        _;
  }
  
    modifier validBettingNumbersRequired(uint8 n1, uint8 n2, uint8 n3, uint8 n4) {
        require(n1 <= 9, 'First digit must be less than 10');
        require(n2 <= 9, 'Second digit must be less than 10');
        require(n3 <= 9, 'Third digit must be less than 10');
        require(n4 <= 9, 'Fourth digit must be less than 10');
        _;
    }
    
    function startGame() public adminRequired {
        // ensure there are no active games
        require(activeGame == false, 'There is an active game already');
        
        // ensure there are no outstanding bets
        require(bets.length == 0, 'There are outstanding bets');
        
        // activate game
        activeGame = true;
        
        // currentGameId + 1
        currentGameId++;
        
        // add new game to gams mapping
        games[currentGameId] = Game(currentGameId, 0, 0);
    }
    
    function endGame() public adminRequired activeGameRequired {
        // reset bets array
        delete bets;
        
        // deactivate game
        activeGame = false;
    }
    
    function placeBet(uint8 n1, uint8 n2, uint8 n3, uint8 n4) payable public activeGameRequired validBettingNumbersRequired(n1, n2, n3, n4) {
        // check and setup bet amount rules
        require(msg.value == 100, 'Bet cost must be 100 wei');
        
        totalBets++;
        
        games[currentGameId].totalBetAmount += msg.value;
        
        BetNumbers memory betNumbers = BetNumbers(n1, n2, n3, n4);
        
        Bet memory bet = Bet(totalBets, msg.sender, msg.value, currentGameId, betNumbers);
        
        bets.push(bet);
    }
    
    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
        reqId = requestId;
        randomNumber = randomness;
        
        // handle random number
    }
    
    function getDrawnNumbers(uint256 rndNumber) public pure returns (uint8, uint8, uint8, uint8) {
        return (
            uint8(rndNumber % 10000 / 1000),
            uint8(rndNumber % 1000 / 100),
            uint8(rndNumber % 100 / 10),
            uint8(rndNumber % 10)
            );
    }
    
    function getRandomNumber(uint256 userProvidedSeed) public returns (bytes32 requestId) {
        require(LINK.balanceOf(address(this)) > fee, "Not enough LINK - fill contract with faucet");
        return requestRandomness(keyHash, fee, userProvidedSeed);
    }
}
