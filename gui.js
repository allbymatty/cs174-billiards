class GUI {
    constructor() {
      this.teamsSet = false;
    }

    setupGame() {
      document.getElementById('menu').style.display="none";
      document.getElementById('game-canvas').style.display="block";
      document.getElementById('HUD').style.display="block";
      this.game = new Game(this);
      
      // Testing
      /*game.pocketedBall(13);
      game.pocketedBall(2);
      game.pocketedBall(5);
      game.pocketedBall(11);
      game.pocketedBall(9);
      game.pocketedBall(1);
      game.pocketedBall(0);
      game.pocketedBall(8);*/
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

    updateTurn(turn) {

      // Switch active turn if necessary
      if (turn == 'player1') {
        this.removeProperty(document.getElementsByClassName('player2')[0], 'active');
        this.addProperty(document.getElementsByClassName('player1')[0], 'active');
      }
      else {
        this.removeProperty(document.getElementsByClassName('player1')[0], 'active');
        this.addProperty(document.getElementsByClassName('player2')[0], 'active');
      }
    }

    updateHUD(remaining_balls, teams) {

      // Set teams
      if (!this.teamsSet) {
        this.teamsSet = true;
        if (teams[PLAYER1] == 'striped') {
          this.addProperty(document.getElementsByClassName('player1')[0], 'striped');
          this.addProperty(document.getElementsByClassName('player2')[0], 'solid');
        }
        else {
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

    endGame(winner) {
      if (winner == 'player1')
        alert("GAME OVER! Player 1 is the Winner!");
      else
        alert("GAME OVER! Player 2 is the Winner!");
    }
}

