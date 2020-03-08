const PLAYER1 = 0;
const PLAYER2 = 1;

class Game {
    constructor() {

        // The numbered balls remaining on the table
        this.remaining_balls = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];

        // Player 1 vs Player 2
        // Player 1 starts first
        this.turnName = 'player1';
        this.turnNum = PLAYER1;

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

    pocketedBall(ballNum) {
        if (ballNum == 0) {
            // Scratch
            alert("SCRATCH!");
            this.turnName = (this.turnName == 'player1' ? 'player2' : 'player1');
            this.turnNum = (this.turnNum == PLAYER1 ? PLAYER2 : PLAYER1);
            gui.updateTurn(this.turnName);
        }
        else if (ballNum == 8) {

            // Assume winning
            let valid = true;

            // Check remaining balls of player who made the 8-ball 
            if (this.teams[this.turnNum] == 'solid') { // SOLID
                for (var k = 0; k < this.remaining_balls.length; k++) {
                    if (this.remaining_balls[k] < 8) 
                        valid = false;
                }
            }
            else { // STRIPED
                for (var k = 0; k < this.remaining_balls.length; k++) {
                    if (this.remaining_balls[k] > 8) 
                        valid = false;
                }
            }

            // Declare winner
            var winner;
            if (valid) 
                winner = this.turnName;
            else
                winner = this.turnName == 'player1' ? 'player1' : 'player2', 

            gui.endGame(winner);

        }
        else {
            // Find the type of the pocketed ball
            var ballType;
            if (ballNum < 8) 
                ballType = 'solid';
            else 
                ballType = 'striped';
                
            // Set teams if have not already
            if (this.teams[PLAYER1] == '')
                this.setTeams(this.turnName, ballType);

            // Remove ball from remaining
            for (var k = 0; k < this.remaining_balls.length; k++) {
                if (ballNum == this.remaining_balls[k]) {
                    this.remaining_balls.splice(k, 1);
                    break;
                }
            }

            // If player made other player's ball, switch turns
            // Otherwise keep turn
            console.log(this.turnName);
            console.log(this.teams[this.turnNum]);
            console.log(ballType);
            console.log("DONE");
            if (this.teams[this.turnNum] != ballType) {
                this.turnName = (this.turnName == 'player1' ? 'player2' : 'player1');
                this.turnNum = (this.turnNum == PLAYER1 ? PLAYER2 : PLAYER1);
                console.log(this.turnName);
                console.log(this.turnNum);
            }
            gui.updateTurn(this.turnName);

            // Make corresponding updates to HUD
            gui.updateHUD(this.remaining_balls, this.teams);
        }
    }
}