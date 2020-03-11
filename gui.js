class GUI {
    constructor() {
      this.teamsSet = false;
    }

    setupGame() {
	  soundmanager.play_start_sound();	
      document.getElementById('menu').style.display="none";
      document.getElementById('game-canvas').style.display="block";
      document.getElementById('HUD').style.display="block";
      this.game = new Game(this);
    }

    addProperty(elem, name) {
      if (elem.classList) {
        elem.classList.add(name);
      }
      else {
        el.className += ' ' + name;
      }
    }

    removeProperty(elem, name) {
      if (elem.classList) {
        elem.classList.remove(name);
      }
      else {
        var tmp = el.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
        elem.className = tmp;
      }
    }

    updateTurn(turn, scratch) {

      document.getElementById("scratch-statement").innerHTML = "";

      // Switch active turn if necessary
      if (turn == 'player1') {
        this.removeProperty(document.getElementsByClassName('player2')[0], 'active');
        this.addProperty(document.getElementsByClassName('player1')[0], 'active');
        document.getElementById("turn-statement").innerHTML = "Player 1 Turn";
        document.getElementById('left-arrow').style.display="block";
        document.getElementById('right-arrow').style.display="none";

        if (scratch)
            document.getElementById("scratch-statement").innerHTML = "Player 2 Scratch!";

      }
      else {
        this.removeProperty(document.getElementsByClassName('player1')[0], 'active');
        this.addProperty(document.getElementsByClassName('player2')[0], 'active');
        document.getElementById("turn-statement").innerHTML = "Player 2 Turn";
        document.getElementById('right-arrow').style.display="block";
        document.getElementById('left-arrow').style.display="none";

        if (scratch)
            document.getElementById("scratch-statement").innerHTML = "Player 1 Scratch!";     
      }
    }

    updateHUD(remaining_balls, teams) {

      // Set teams
      if (!this.teamsSet) {
        this.teamsSet = true;
        console.log("SETTING TEAMS")
        if (teams[PLAYER1] == 'striped') {
          this.addProperty(document.getElementsByClassName('player1')[0], 'striped');
          this.addProperty(document.getElementsByClassName('player2')[0], 'solid');
        }
        else if (teams[PLAYER1] == 'solid') {
          this.addProperty(document.getElementsByClassName('player1')[0], 'solid');
          this.addProperty(document.getElementsByClassName('player2')[0], 'striped');        }
      }

      // Number the balls corresponding to teams
      var player = (teams[PLAYER1] == 'solid' ? "player1" : "player2");
      var parent = document.createElement('ul');

      for (var k=1; k<8; k++) {
        var child = document.createElement('li');
        child.textContent = k;
        if (remaining_balls.indexOf(k) == -1) {
          this.addProperty(child, 'pocketed');
        }

        parent.appendChild(child);
      }
      document.getElementsByClassName(player)[0].replaceChild(parent, document.getElementsByClassName(player)[0].children[1]);

      parent = document.createElement('ul');
      player = (teams[PLAYER1] == 'striped' ? "player1" : "player2");
      for (var k=9; k<16; k++) {
        var child = document.createElement('li');
        child.textContent = k;
        if (remaining_balls.indexOf(k) == -1) {
          this.addProperty(child, 'pocketed');
        }

        parent.appendChild(child);
      }
      document.getElementsByClassName(player)[0].replaceChild(parent, document.getElementsByClassName(player)[0].children[1]);
    }

    resetGame() {
          this.removeProperty(document.getElementsByClassName('player1')[0], 'striped');
          this.removeProperty(document.getElementsByClassName('player2')[0], 'solid');
          this.removeProperty(document.getElementsByClassName('player1')[0], 'solid');
          this.removeProperty(document.getElementsByClassName('player2')[0], 'striped'); 

          var parent = document.createElement('ul');
          for (var k=0; k<7; k++) {
            var child = document.createElement('li');
            child.textContent = '?';
            this.removeProperty(child, 'pocketed');
            parent.appendChild(child);
          }
          document.getElementsByClassName("player1")[0].replaceChild(parent, document.getElementsByClassName("player1")[0].children[1]);
          
          var parent = document.createElement('ul');
          for (var k=0; k<7; k++) {
            var child = document.createElement('li');
            child.textContent = '?';
            this.removeProperty(child, 'pocketed');
            parent.appendChild(child);
          }
          document.getElementsByClassName("player2")[0].replaceChild(parent, document.getElementsByClassName("player2")[0].children[1]);

          this.teamsSet = false;
          this.updateTurn("player1", false);
          document.getElementById('end-screen').style.display="none";
    }

    endGame(winner) {
        console.log("WINNER!!");
        console.log(winner);
        if (winner == "player1")
            document.getElementById("statement").innerHTML = "Player 1 Wins!";
        else 
            document.getElementById("statement").innerHTML = "Player 2 Wins!";

        document.getElementById('end-screen').style.display="block";

    }
}

