import express from "express";
import socketio from "socket.io";
import path from "path";
import cors from 'cors';
import mysql2 from 'mysql2';


var connection = mysql2.createConnection({
  host: '100.103.227.61',
  user: 'diplom',
  password: 'password',
  database: 'test'
})

connection.connect()

connection.query('SELECT 1 + 1 AS solution', function (err, rows, fields) {
  if (err) throw err
  console.log('The solution is: ', rows[0].solution)
})

// create tables with foreign keys
connection.execute('CREATE TABLE IF NOT EXISTS users ( id INTEGER PRIMARY KEY NOT NULL AUTO_INCREMENT, username VARCHAR(256), password VARCHAR(32) NOT NULL,email VARCHAR(320),is_admin INTEGER DEFAULT 0 NOT NULL, created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP);');

connection.execute('CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY NOT NULL AUTO_INCREMENT,name VARCHAR(256),created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP);');

connection.execute('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY NOT NULL AUTO_INCREMENT,user_id INTEGER NOT NULL,chat_id INTEGER NOT NULL,msg_type INTEGER,msg VARCHAR(4096),CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id),CONSTRAINT fk_chat_id FOREIGN KEY (chat_id) REFERENCES chats(id));');


connection.execute('CREATE TABLE IF NOT EXISTS chat_users (id INTEGER PRIMARY KEY NOT NULL AUTO_INCREMENT,user_id INTEGER NOT NULL,chat_id INTEGER NOT NULL,CONSTRAINT fk_cu_user_id FOREIGN KEY (user_id) REFERENCES users(id),CONSTRAINT fk_cu_chat_id FOREIGN KEY (chat_id) REFERENCES chats(id));');

connection.query('SELECT * from users',[], (err, results) => {
    console.log(results);
  }
);

interface Imessage{
  sender: string;
  content: string;
}

let messages :Imessage[] = [
  {sender: "timy", content: "hello world"},
  {sender: "mathias", content: "hello world2"},
  {sender: "mathias", content: "hello world3"},
];

const app = express();
app.set("port", process.env.PORT || 8080);
app.use(cors())


let http = require("http").Server(app);
// set up socket.io and bind it to our
// http server.
let io = require("socket.io")(http);

app.get("/", (req: any, res: any) => {
  res.sendFile(path.resolve("./client/index.html"));
});
app.get("/getMessages", (req:any, res: any)=>{
  res.send({items: messages});
})

// whenever a user connects on port 3000 via
// a websocket, log that a user has connected
io.on("connection", function(socket: any) {
  console.log("a user connected");
  socket.on("test", (arg: Imessage)=>{
    console.log("succesful", arg)
    messages.push(arg)
    socket.broadcast.emit("reload","reloadAll");
    socket.emit("reload","reloadAll");
  })

});

io.on("User", (socket: socketio.Socket) =>{
  console.log("User Online");
})


const server = http.listen(8080, function() {
  console.log("listening on *:8080");
});







// import express, { Express, Request, Response } from 'express';
// import * as http from 'http';
// import cors from 'cors'

// // import next, { NextApiHandler } from 'next';
// import * as socketio from 'socket.io';
// const app = express()
// const port = 8080
// const server: http.Server = http.createServer(app);
// app.use(cors())

// app.listen(port, () => {
//   console.log(`Example app listening on port ${port}`)
// })



// const io: socketio.Server = new socketio.Server(server ,{
//   cors: {
//     "origin": "*",
//     "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
//     "preflightContinue": false,
//     "optionsSuccessStatus": 204
//   }    
// });    

// io.on("connect_error", (err) => {
//   console.log(`connect_error due to ${err.message}`);
// });  

// io.on('connection', (socket) => {
//   console.log('a user connected');
// });  



// io.on('connection', (socket: socketio.Socket) => {
//   console.log('connection');
//   socket.emit('status', 'Hello from Socket.io');
//   socket.on('disconnect', () => {
//     console.log('client disconnected');
//   })  
// });  
// io.on("User", (socket: socketio.Socket) =>{
//   console.log("User Online");
// })  



// app.get('/', (req:Request, res:Response) => {
//   res.send('Hello World!')
// })  

// io.attach(server);

