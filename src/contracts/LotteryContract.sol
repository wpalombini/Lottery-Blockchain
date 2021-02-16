// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.8.0;

pragma experimental ABIEncoderV2;

import "@chainlink/contracts/contracts/v0.6/VRFConsumerBase.sol";

import { IRandomnessContract } from "./interfaces/IRandomnessContract.sol";
import { IGovernanceContract } from "./interfaces/IGovernanceContract.sol";

contract LotteryContract {
    IGovernanceContract public governance;
    
    uint256 public bettingPrice = 100;
    
    address payable admin;
    
    bool public activeGame;
    uint public currentGameId = 1;
    uint totalBets = 0;

    bool outstandingBets = false;
    
    struct Game {
        uint id;
        uint randomNumber;
        uint totalBetAmount;
        BettingNumbers drawnNumbers;
    }
    
    mapping (uint => Game) public games;
    
    struct Bet {
        uint id;
        address payable player;
        uint bettingAmount;
        uint gameId;
        BettingNumbers bettingNumbers;
    }
    
    struct BettingNumbers {
        uint8 n1;
        uint8 n2;
        uint8 n3;
        uint8 n4;
    }
    
    Bet[] public bets;
    
    /**
     * Constructor inherits VRFConsumerBase
     * 
     * Network: Kovan
     * Chainlink VRF Coordinator address: 0xdD3782915140c8f3b190B5D67eAc6dc5760C46E9
     * LINK token address:                0xa36085F69e2889c224210F603D836748e7dC0088
     * Key Hash: 0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4
     */
    constructor(address _governance) public {
        admin = msg.sender;
        governance = IGovernanceContract(_governance);
    }
    
    modifier activeGameRequired() {
        require(activeGame == true, "There are no active games accepting bets");
        require(games[currentGameId].id == currentGameId, "cannot find game");
        _;
    }
    
    modifier adminRequired() {
        require(msg.sender == admin, "Only admin has access to this resource");
        _;
  }
  
    modifier validBettingNumbersRequired(uint8 n1, uint8 n2, uint8 n3, uint8 n4) {
        require(n1 <= 9, "First digit must be less than 10");
        require(n2 <= 9, "Second digit must be less than 10");
        require(n3 <= 9, "Third digit must be less than 10");
        require(n4 <= 9, "Fourth digit must be less than 10");
        _;
    }

    modifier validBettingPrice() {
        require(msg.value == bettingPrice, "Invalid betting price");
        _;
    }

    modifier noOutstandingBetsRequired() {
        require(!outstandingBets, "There are outstanding bets");
        _;
    }
    
    function startGame() public adminRequired {
        // ensure there are no active games
        require(activeGame == false, "There is an active game already");
        
        // ensure there are no outstanding bets
        require(bets.length == 0, "There are outstanding bets");
        
        // activate game
        activeGame = true;
        
        // currentGameId + 1
        currentGameId++;
        
        // add new game to games mapping
        games[currentGameId] = Game(currentGameId, 0, 0, BettingNumbers(0, 0, 0, 0));
    }
    
    function endGame() public adminRequired activeGameRequired noOutstandingBetsRequired {
        // reset bets array
        delete bets;
        
        // deactivate game
        activeGame = false;
    }
    
    function placeBet(uint8 n1, uint8 n2, uint8 n3, uint8 n4) payable public activeGameRequired validBettingPrice validBettingNumbersRequired(n1, n2, n3, n4) {
        if (!outstandingBets) {
            outstandingBets = true;
        }

        totalBets++;
        
        games[currentGameId].totalBetAmount += msg.value;
        
        BettingNumbers memory bettingNumbers = BettingNumbers(n1, n2, n3, n4);
        
        Bet memory bet = Bet(totalBets, msg.sender, msg.value, currentGameId, bettingNumbers);
        
        bets.push(bet);
    }
    
    function drawNumbers(uint256 seed) public adminRequired returns (bytes32 requestId) {
        return getRandomNumber(seed);
    }

    function getRandomNumber(uint256 userProvidedSeed) public returns (bytes32 requestId) {
        return IRandomnessContract(governance.randomness()).randomNumber(userProvidedSeed);
    }

    function fulfill_random(uint256 _randomness) external {
        games[currentGameId].randomNumber = _randomness;

        processDrawnNumbers();
    }
    
    function processDrawnNumbers() private {
        uint256 randomNumber = games[currentGameId].randomNumber;

        uint8 n1 = uint8(randomNumber % 10000 / 1000);
        uint8 n2 = uint8(randomNumber % 1000 / 100);
        uint8 n3 = uint8(randomNumber % 100 / 10);
        uint8 n4 = uint8(randomNumber % 10);

        games[currentGameId].drawnNumbers = BettingNumbers(n1, n2, n3, n4);

        payoutPrizes();
    }

    function payoutPrizes() private {
        // find winners

        // payout prizes

        outstandingBets = false;
    }
}
