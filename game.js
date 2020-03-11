const PLAYER1 = 0;
const PLAYER2 = 1;

class Game {
    constructor(gui) {
        this.gui = gui;

        // The numbered balls remaining on the table
        this.remaining_balls = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];

        // Player 1 vs Player 2
        // Player 1 starts first
        this.turnName = 'player1';
        this.turnNum = PLAYER1;

        this.gui.updateTurn(this.turnName, false);

        // Indicates the teams of the players (striped vs solid)
        this.teams = ['', ''];
    }

    setTeams(player, team) {
        if (player == 'player1') {
            this.teams[PLAYER1] = (team == 'solid' ? 'solid': 'striped');
            this.teams[PLAYER2] = (team == 'solid' ? 'striped' : 'solid');
        }
        else {
            this.teams[PLAYER2] = (team == 'solid' ? 'solid': 'striped');
            this.teams[PLAYER1] = (team == 'solid' ? 'striped' : 'solid');       
        }
    }

    // takes list of pocket balls, in order of sinking
    // returns true if game over
    pocketedBalls(ballNums) {
        // If no balls made, switch turns
        if (ballNums.length == 0) {
            this.turnName = (this.turnName == 'player1' ? 'player2' : 'player1');
            this.turnNum = (this.turnNum == PLAYER1 ? PLAYER2 : PLAYER1);
            this.gui.updateTurn(this.turnName, false);
            console.log("NO BALLS MADE");
        }

        //check if they scratched and also got 8-ball in, losing game
        else if (ballNums.includes(0) && ballNums.includes(8)) {
            winner = this.turnName == 'player1' ? 'player2' : 'player1';
            this.gui.endGame(winner);
            return true;
        }
        else if (ballNums.includes(0)) {
            // remove any other pocketed balls from remaining_balls
            // set teams if needed
            let ballType = 'none';
            for (let i = 0; i < ballNums.length; i++) {
                if (ballNums[i] != 0) {
                    // set teams if not set
                    if (this.teams[PLAYER1] == '') {
                        // Find the type of the pocketed ball
                        if (ballType == 'none') {
                            if (ballNums[i] < 8)
                                ballType = 'solid';
                            else
                                ballType = 'striped';
                        }

                        this.setTeams(this.turnName, ballType);
                    }

                    for (let j = 0; j < this.remaining_balls.length; j++) {
                        if (ballNums[i] == this.remaining_balls[j]) {
                            this.remaining_balls.splice(j, 1);
                            console.log(ballNums[i] + "removed!");
                            break;
                        }
                    }
                }
            }

            // Scratch              
            this.turnName = (this.turnName == 'player1' ? 'player2' : 'player1');
            this.turnNum = (this.turnNum == PLAYER1 ? PLAYER2 : PLAYER1);
            this.gui.updateTurn(this.turnName, true);
            this.gui.updateHUD(this.remaining_balls, this.teams);
        }
        else if (ballNums.includes(8)) {
            console.log("8 ball sunked by");
            console.log(this.turnName);
            // remove any other pocketed balls from remaining_balls
            // remove ONLY those that were sunk before 8 ball
            let i = 0;
            for (; i < ballNums.length && ballNums[i] != 8; i++) {
                for (let j = 0; j < this.remaining_balls.length; j++) {
                    if (ballNums[i] == this.remaining_balls[j]) {
                        this.remaining_balls.splice(j, 1);
                        console.log(ballNums[i] + "removed!");
                        break;
                    }
                }
            }
            this.gui.updateHUD(this.remaining_balls, this.teams);

            // Assume winning
            var valid = true;

            // Check remaining balls of player who made the 8-ball 
            if (this.teams[this.turnNum] == 'solid') { // SOLID
                for (var k = 0; k < this.remaining_balls.length; k++) {
                    if (this.remaining_balls[k] < 8 && this.remaining_balls[k] != 0) {
                        valid = false;
                        console.log(valid);
                        console.log("solid ball remaining");
                        break;
                    }
                }
            }
            else { // STRIPED
                for (var k = 0; k < this.remaining_balls.length; k++) {
                    if (this.remaining_balls[k] > 8) {
                        valid = false;
                        console.log(valid);
                        console.log("striped ball remaining");
                        break;
                    }
                }
            }

            // Declare winner
            var winner;
            console.log(valid);
            if (valid) 
                winner = this.turnName;
            else
                winner = this.turnName == 'player1' ? 'player2' : 'player1'; 

            this.gui.endGame(winner);
            return true;

        }
        else {
            let firstBall = '';
            if (ballNums[0] < 8)
                firstBall = 'solid';
            else
                firstBall = 'striped';

            // Set teams if have not already
            if (this.teams[PLAYER1] == '')
                    this.setTeams(this.turnName, firstBall);

            // Remove first ball and other balls if any
            let mixed = false;
            for (let i = 0; i < ballNums.length; i++) {

                // Check for mixed balls
                if (!mixed) {
                    if (firstBall == 'solid' && ballNums[i] > 8)
                        mixed = true;
                    else if (firstBall == 'striped' && ballNums[i] < 8)
                        mixed = true;
                }

                // Remove ball from remaining
                for (var k = 0; k < this.remaining_balls.length; k++) {
                    if (ballNums[i] == this.remaining_balls[k]) {
                        this.remaining_balls.splice(k, 1);
                        console.log(ballNums[i] + "removed!");
                        break;
                    }
                }
            }

            // If player makes both types of balls, keep turn 
            // If player makes only other player's ball, switch turns
            // Otherwise stay turn
            console.log(this.turnName);
            console.log(this.teams[this.turnNum]);
            console.log("DONE");
            
            if (!mixed && firstBall != this.teams[this.turnNum]) {
                this.turnName = (this.turnName == 'player1' ? 'player2' : 'player1');
                this.turnNum = (this.turnNum == PLAYER1 ? PLAYER2 : PLAYER1);
                console.log(this.turnName);
                console.log(this.turnNum);
            }
            this.gui.updateTurn(this.turnName, false);

            // Make corresponding updates to HUD
            this.gui.updateHUD(this.remaining_balls, this.teams);
        }
        // game not over, so return false
        return false;
    }
}