(function(){  
  // Start a socket connection to the server
  var socket = io();
  var globals = {
    middle:null,
    startX:null,
    startY:null,
    yourTurn:false,
    team: null,
    cp: null
  };
  
  var teams = {
    1 : 'x',
    2 : 'o'
  };
  var symbols = {
    1 : 'Red',
    2 : 'Blue'
  }
  var teamToColor = {
    x: 'Red',
    o: 'Blue'
  }
  
  var timerInterval = null;

  socket.on('team',function(team){
    globals.team = team;
    document.getElementById('team').innerText = teamToColor[team];
  });

  socket.on('currentPlayer',function(cp){
      globals.cp = cp;
      globals.yourTurn = cp == globals.team;
      document.getElementById('cp').innerText = teamToColor[cp];
      clearInterval(timerInterval);
      document.getElementById('timer').innerText = 20;
    document.getElementById('selection').innerText = '';
  });
  
  socket.on('playerCount',function(count){
      document.getElementById('players').innerText = count;
      if(count === 1){
        document.getElementById('invite').style.display = "block";
      }else{
        document.getElementById('invite').style.display = "none";
      }
  });
  
  socket.on('timeoutStart',function(){
    document.getElementById('timer').innerText = 20;
    timerInterval = setInterval(function(){
      document.getElementById('timer').innerText = parseInt(document.getElementById('timer').innerText)-1;
    },1000);
  });

  var sketch = function(p){
    var settings = {
      gridSize : 100
    }
    
    var colors;

    p.setup = function() {
      var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
      colors = {
        x : p.color(255,0,0),
        o : p.color(0,0,255)
      };
      p.createCanvas(w,h);
      p.background(0);
      drawGrid(p);
      // We make a named event called 'mouse' and write an
      // anonymous callback function
      socket.on('fill',
        // When we receive data
        function(data) {
          // Draw a blue circle
          p.fill(colors[globals.cp]);
          p.noStroke();
          p.ellipse(globals.startX + data.x*settings.gridSize + settings.gridSize/2,globals.startY + data.y*settings.gridSize + settings.gridSize/2,settings.gridSize/2,settings.gridSize/2);
        }
      );
      // get the already filled cells
      socket.on('filled',function(filled){
        filled.forEach((f)=>{
          p.fill(colors[teams[f.team]]);
          p.noStroke();
          p.ellipse(globals.startX + f.coords[0]*settings.gridSize + settings.gridSize/2,globals.startY + f.coords[1]*settings.gridSize + settings.gridSize/2,settings.gridSize/2,settings.gridSize/2);
        });
      });
  
      socket.on('winner',function(winner){
        var message = '';
          if(winner != 0){
            message = symbols[winner]+' team won !';
          }else{
            message = 'Draw';
          }
        document.getElementById('won').innerText = message;
        drawGrid(p);
      });
    }

    function drawGrid(p){
      p.background(0);
      globals.middle = p.createVector(p.width/2,p.height/2);
      globals.startX = globals.middle.x - (settings.gridSize * 1.5);
      globals.startY = globals.middle.y - (settings.gridSize * 1.5);
      p.stroke('#fff');
      for(var i = 0; i <= 3; i++){
          p.line(globals.startX, i*settings.gridSize + globals.startY, 3*settings.gridSize + globals.startX, i*settings.gridSize + globals.startY);
      }
      for(var i = 0; i <= 3; i++){
          p.line(i*settings.gridSize + globals.startX, globals.startY, i*settings.gridSize + globals.startX, 3*settings.gridSize + globals.startY);
      }
    }

    function draw() {
      // If we got some things to animate, it'll be here
      
    }

    p.mouseClicked = function() {
      if(globals.yourTurn){
        let coords = p.getBoardCoords();
        // Send the mouse coordinates if valids
        if(coords){
          sendmouse(coords);
          document.getElementById('selection').innerText = coords.x+','+coords.y;
        }
      }
    }

    p.getBoardCoords = function(){
      let coords = {x:Math.floor((p.mouseX - globals.startX) / settings.gridSize),y:Math.floor((p.mouseY - globals.startY) / settings.gridSize)};
      if(coords.x < 0 || coords.x > 2 || coords.y < 0 || coords.y > 2){
        return false;
      }
      return coords;
    }

    // Function for sending to the socket
    function sendmouse(coords) {

      // Send that object to the socket
      socket.emit('choice',coords);
    }
  }
  
  window['debug'] = function(){
    console.log(globals);
  }
  
  new p5(sketch);
})()