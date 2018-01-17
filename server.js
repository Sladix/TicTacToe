// Based off of Shawn Van Every's Live Web
// http://itp.nyu.edu/~sve204/liveweb_fall2013/week3.html


// HTTP Portion
var http = require('http');
// URL module
var url = require('url');
var path = require('path');

// Using the filesystem module
var fs = require('fs');

var server = http.createServer(handleRequest);
server.listen(8080);

console.log('Server started on port 8080');

function handleRequest(req, res) {
  // What did we request?
  var pathname = req.url;
  
  // If blank let's ask for index.html
  if (pathname == '/') {
    pathname = '/index.html';
  }
  
  // Ok what's our file extension
  var ext = path.extname(pathname);

  // Map extension to file type
  var typeExt = {
    '.html': 'text/html',
    '.js':   'text/javascript',
    '.css':  'text/css'
  };

  // What is it?  Default to plain text
  var contentType = typeExt[ext] || 'text/plain';

  // User file system module
  fs.readFile(__dirname + pathname,
    // Callback function for reading
    function (err, data) {
      // if there is an error
      if (err) {
        res.writeHead(500);
        return res.end('Error loading ' + pathname);
      }
      // Otherwise, send the data, the contents of the file
      res.writeHead(200,{ 'Content-Type': contentType });
      res.end(data);
    }
  );
}

/******************/
/** Game portion **/
/******************/
var players = {
  x : [],
  o : []
};

var symbols = {
  x : 1,
  o : 2
};

var currentGrid;
var currentTeamStartedPlaying = false;
var currentTeamPlayed = 0;
var currentVotedCoords = [];
var hasPlayedThisTurn = [];
var turnTimeout = 20000;
var currentTurn = 'x';
var filledCells = 0;
var nexTurnTimeout = null;
// Clean the grid
function cleanGrid(){
  filledCells = 0;
  currentGrid = [];
  for(let i = 0 ; i < 3; i++){
    currentGrid[i] = [];
    for(let j = 0 ; j < 3; j++){
      currentGrid[i][j] = 0;
    } 
  }
}
// get the filled cells
function getFilled(){
  let filled = [];
  for(let i = 0 ; i < 3; i++){
    for(let j = 0 ; j < 3; j++){
      if(currentGrid[i][j] != 0){
        filled.push({team:currentGrid[i][j],coords:[i,j]});
      } 
    }
  }
  return filled;
}

// Remove a player from team
function delete_player(socket){
  players.x = players.x.filter((p)=>{return p !== socket.id});
  players.o = players.o.filter((p)=>{return p !== socket.id});
}

// Get the team index with the least players
function get_next_player_team(){
  if(players.x.length > players.o.length){
    return 'o';
  }else{
    return 'x';
  }
}

// Add a vote or coords to the current team selection
function addVote(coords){
  let candidate = currentVotedCoords.find((f)=>{ return f.coords.x == coords.x && f.coords.y == coords.y });
  if(candidate){
    candidate.vote++;
  }else{
    currentVotedCoords.push({coords:coords,vote:1});
  }
  currentTeamPlayed++;
}

// Get the next coords played by a team
function get_most_votes_coords(){
  return currentVotedCoords.sort((a,b)=>{return b.vote - a.vote}).shift();
}

// Handle a player submission
function handleChoice(coords,sid){
  if(hasPlayedThisTurn.indexOf(sid) !== -1){
    return;
  }
  // If this is the first play of a team, set the flag
  if(!currentTeamStartedPlaying){
    currentTeamStartedPlaying = true;
    currentTeamPlayed++;
    currentVotedCoords.push({coords:coords,votes:1});
    // Trigger the timeOut
    nexTurnTimeout = setTimeout(play_team_turn,turnTimeout);
    console.log('Time out set');
    io.emit('timeoutStart');
  }else{
    addVote(coords);
  }
  
  hasPlayedThisTurn.push(sid);
  
  // Check if anyone in the team has played
  if(currentTeamPlayed == players[currentTurn].length){
    play_team_turn();
  }else{
    console.log(currentTeamPlayed,players[currentTurn].length);
  }
}

// Play team turn
function play_team_turn(){
  var filled = get_most_votes_coords();
  currentGrid[filled.coords.x][filled.coords.y] = symbols[currentTurn];
  io.emit('fill',filled.coords);
  filledCells++;
  next_turn();
}

// Check if we have a winner
function checkWin(){
  var winningChecks = [
    [[0,0],[1,1],[2,2]], // top left bottom right diagonal
    [[2,0],[1,1],[0,2]], // top right bottom left diagonal
    [[0,0],[0,1],[0,2]], // Col 1
    [[1,0],[1,1],[1,2]], // Col 2
    [[2,0],[2,1],[2,2]], // Col 3
    [[0,0],[1,0],[2,0]], // Row 1
    [[0,1],[1,1],[2,1]], // Row 2
    [[0,2],[1,2],[2,2]], // Row 3
  ];
  let win = null;
  winningChecks.forEach((c)=>{
    if(currentGrid[c[0][0]][c[0][1]] != 0 && currentGrid[c[0][0]][c[0][1]] == currentGrid[c[1][0]][c[1][1]] && currentGrid[c[0][0]][c[0][1]] == currentGrid[c[2][0]][c[2][1]]){
      // We have a winner
      win = currentGrid[c[0][0]][c[0][1]];
      return;
    }
  });
  if(filledCells == 9){
    // Draw
    win = 0;
  }
  return win;
}

// Trigger the next turn
function next_turn(){
  currentTeamStartedPlaying = false;
  hasPlayedThisTurn = [];
  currentTeamPlayed = 0;
  currentVotedCoords = [];
  clearTimeout(nexTurnTimeout);
  var winner = checkWin();
  currentTurn = (currentTurn == 'x')?'o':'x';
  if(winner !== null){
    io.emit('winner',winner);
    cleanGrid();
  }
  io.emit('currentPlayer',currentTurn);
}

// Init the grid
cleanGrid();

// WebSocket Portion
// WebSockets work with the HTTP server
var io = require('socket.io').listen(server);

// Register a callback function to run when we have an individual connection
// This is run for each individual user that connects
io.sockets.on('connection',
  // We are given a websocket object in our function
  function (socket) {
  
    console.log("We have a new client: " + socket.id);
    // Assign player to a team
    let team = get_next_player_team();
    players[team].push(socket.id);
    // Let the player know in which team he is and who's turn is it
    socket.emit('team',team);
    socket.emit('currentPlayer',currentTurn);
    socket.emit('filled',getFilled());
    io.emit('playerCount',players.x.length + players.o.length);
  
    socket.on('choice',function(coords){
      handleChoice(coords,socket.id);
    });
    
    socket.on('disconnect', function() {
      console.log("Client has disconnected");
      delete_player(socket);
    io.emit('playerCount',players.x.length + players.o.length);
    });
  }
);