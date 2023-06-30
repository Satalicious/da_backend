import express, { Request, Response} from "express";
import socketio from "socket.io";
import cors from 'cors';
import session from 'express-session';
import { connection, createUser, validateCredentials, getUserById, getUserByMail, getMessagesByChatId, getChatsByUserId, sendMessage, createChat, addUserToChat, removeUserFromChat, deleteChat, getMatchingUser, createChatUser, validatePassword, getUsersByChatId, comparePasswords, getHashedPassword, changeProfilePicture, changeChatPicture } from './utils/database/dbTools'
import { Chat, ChatUser, Message, User } from './index.interface'
import bodyParser from 'body-parser';
import fs from "fs";
import path from "path";
require('dotenv').config();
declare module "express-session" {
  interface SessionData {
    user: User;
  }
}

async function createTables() {
  // creates tables if they exist and afterwards calls insertUsers() to fill the users table with example data
  try {
      await connection.execute(`
          CREATE TABLE IF NOT EXISTS users (
              id INTEGER AUTO_INCREMENT PRIMARY KEY,
              username VARCHAR(256),
              password VARCHAR(255) NOT NULL,
              email VARCHAR(320),
              is_admin INTEGER DEFAULT 0 NOT NULL,
              created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              profile_picture MEDIUMTEXT
          );
      `);

      await connection.execute(`
          CREATE TABLE IF NOT EXISTS chats (
              id INT AUTO_INCREMENT PRIMARY KEY,
              name VARCHAR(256),
              last_message MEDIUMTEXT,
              created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              last_message_sent TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              chat_admin_id INT,
              isRoom BOOLEAN,
              chat_picture MEDIUMTEXT,
              CONSTRAINT fk_chat_admin_id FOREIGN KEY (chat_admin_id) REFERENCES users(id)
          );
      `);

      await connection.execute(`
          CREATE TABLE IF NOT EXISTS messages (
              id INTEGER AUTO_INCREMENT PRIMARY KEY,
              user_id INTEGER NOT NULL,
              chat_id INTEGER NOT NULL,
              msg_type INTEGER,
              msg MEDIUMTEXT,
              created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id),
              CONSTRAINT fk_chat_id FOREIGN KEY (chat_id) REFERENCES chats(id)
          );
      `);

      await connection.execute(`
          CREATE TABLE IF NOT EXISTS chat_users (
              id INTEGER AUTO_INCREMENT PRIMARY KEY,
              user_id INTEGER NOT NULL,
              chat_id INTEGER NOT NULL,
              CONSTRAINT fk_cu_user_id FOREIGN KEY (user_id) REFERENCES users(id),
              CONSTRAINT fk_cu_chat_id FOREIGN KEY (chat_id) REFERENCES chats(id)
          );
      `);

      await insertUsers();

  } catch (error) {
      console.error("Error creating tables:", error);
  }
}

async function insertUsers() {
  try {
    const [rows] = await connection.query("SELECT COUNT(*) AS count FROM users");

    if (rows[0].count > 0) {
      return;
    }

    const filePath = path.join(__dirname, 'users.json');
    const fileData = fs.readFileSync(filePath, 'utf8');
    const users = JSON.parse(fileData);

    let user1Id = null;
    const chatIds = {};

    // Insert users and get user1Id
    for (let user of users) {
      const hashedPassword = getHashedPassword(user.password);
      const [result] = await connection.execute(
        'INSERT INTO users (username, password, email, is_admin, profile_picture) VALUES (?, ?, ?, ?, ?)',
        [user.username, hashedPassword, user.email, user.is_admin, user.profile_picture]
      );

      const userId = result.insertId;

      if (user.username === 'user1') {
        user1Id = userId;
      }

      // Insert chats and map chat names to chat IDs
      if (user.chats) {
        for (const chat of user.chats) {
          if (!chatIds[chat.name]) {
            const [chatResult] = await connection.execute(
              'INSERT INTO chats (name, chat_admin_id, isRoom) VALUES (?, ?, 1)',
              [chat.name, user1Id]
            );

            chatIds[chat.name] = chatResult.insertId;

            // Insert user1 into chat_users for each chat
            await connection.execute(
              'INSERT INTO chat_users (user_id, chat_id) VALUES (?, ?)',
              [user1Id, chatIds[chat.name]]
            );
          }

          // Insert other users into chat_users if they are not user1
          if (userId !== user1Id) {
            await connection.execute(
              'INSERT INTO chat_users (user_id, chat_id) VALUES (?, ?)',
              [userId, chatIds[chat.name]]
            );
          }
        }
      }
    }

    console.log("Users and chats inserted successfully");
  } catch (error) {
    console.error("Error inserting users and chats:", error);
  }
}








(async () => {
  await createTables();
})();

const app = express();
app.set("port", process.env.PORT || 8080);
app.use(cors({ origin: true, credentials: true }));
app.use(session({
  secret: 'your_secret_key_here', // this should be a random string
  resave: false,
  saveUninitialized: false,
  cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: false
    },
}));

app.use(bodyParser.json())

let http = require("http").Server(app);
let io = require("socket.io")(http); // set up socket.io and bind it to our http server.

app.get("/", async (req: Request, res: Response) => {
  res.send("hi")
});

app.get("/getUserById/:userId", (req: Request, res: Response) => {
  const { userId } = req.params;
  const promGetUserById = new Promise((resolve, reject) => {
    resolve(getUserById(parseInt(userId)));
  });
  promGetUserById.then((result: User) => {
    res.send({result});
  })  
})

app.get("/getMessagesByChatId/:chatId", (req: Request, res: Response) => {
  const { chatId } = req.params;
  const promGetMessagesByChatId = new Promise((resolve, reject) => {
    resolve(getMessagesByChatId(parseInt(chatId)));
  });
  promGetMessagesByChatId.then((result: Message[]) => {
    res.send({result});
  })  
})

app.get("/getChatsByUserId/:userId", (req: Request, res: Response) => {
  const { userId } = req.params;
  const promGetChatsByUserId = new Promise((resolve, reject) => {
    resolve(getChatsByUserId(parseInt(userId)));
    });
    promGetChatsByUserId.then((result: Chat[]) => {
      res.send({result});
    })  
})

app.post("/createChat", (req: Request, res: Response) => {
  const promCreateChat = new Promise((resolve, reject) => {
    resolve(createChat(req.body.chatName, req.body.creatorId, req.body.selectedUser.length > 1));
    resolve(console.log("createChat body", req.body.selectedUser))
  });
  promCreateChat.then((res) => {
      //@ts-ignore
    createChatUser({user: {id: req.body.creatorId}, chat_id: res.insertId as number} )
    console.log("createChat: ",res);
    req.body.selectedUser.forEach((user: User)=>{
      //@ts-ignore
      createChatUser({user: user, chat_id: res.insertId as number} )
    })
  })
})

app.post("/getUserByChatId", (req, res) => {
  const getUserPromise = new Promise((resolve, reject) => {
    resolve(getUsersByChatId(req.body.chat_id, req.body.currentUserId));
  });

  getUserPromise
    .then((users) => {
      res.json(users); // Sending the response back to the frontend as JSON
    })
    .catch((error) => {
      // Handle any error that occurred during the getUserByChatId function
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    });
});

app.post("/deleteChat", (req: Request, res: Response) => {
  // NEEDS TEST
  const promCreateChat = new Promise((resolve, reject) => {
    resolve(deleteChat(req.body.chatId));
  });
  promCreateChat.then((res) => {
    console.log("deleteChat: ",res);
  })
})

app.post("/addUserToChat", (req: Request, res: Response) => {
  const promAddUserToChat = new Promise((resolve, reject) => {
    resolve(addUserToChat(req.body.userId, req.body.chatId));
  })
  promAddUserToChat.then((res) => {
    console.log("addUserToChat: ", res)
  })
})

app.post("/removeUserFromChat", (req: Request, res: Response) => {
  // NEEDS TEST
  const promAddUserToChat = new Promise((resolve, reject) => {
    resolve(removeUserFromChat(req.body.userId, req.body.chatId));
  })
  promAddUserToChat.then((res) => {
    console.log("removeUserFromChat: ", res)
  })
})

app.post('/login', async (req: Request, res: Response) => {
  const { password, email } = req.body;
  try {
    const user: User = await getUserByMail(email);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const isMatch = comparePasswords(password, user.password); // compare the password with the hashed password stored in DB

    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    req.session.user = user; 
    res.json({ message: 'Logged in successfully!', user }); // valid credentials, set user in the session

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});


app.post('/changePassword', async (req, res) => {
  // user can change their password on the profile page, password must meet specific requirements. password is hashed and stored in db.
  const { oldPassword, newPassword, email } = req.body;
  try {
    const user: User = await getUserByMail(email);

    if (!user) { res.status(404).send('User not found'); return; }

    const isOldPasswordValid = comparePasswords(oldPassword, user.password);
    if (!isOldPasswordValid) { res.status(401).send('Invalid old password'); return; }

    const hashedNewPassword = getHashedPassword(newPassword);
    await connection.execute('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, user.id]);

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.post('/getSession', (req: Request, res: Response) => {
  const user = req.session.user;
  if (user) {
    res.json({ message: 'Logged in!', user });
  } else {
    res.status(401).json({ message: 'Not logged In' });
  }  
});

app.post('/logout', (req: Request, res: Response) => {
  req.session.user = null; // set the user property to null
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: 'Error destroying session' });
    } else {
      res.clearCookie('session'); // clear the cookie from the client
      res.status(200).json({ message: 'Session destroyed', user: null });
    }
  });
});

app.post("/sendMessage", async (req: Request, res: Response) => {
  try {
    const messages: Message[] = req.body;
    const results = await Promise.all(messages.map(message => sendMessage(message)));
    console.log("results:", results);
    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error sending messages");
  }
});


// TODO: THEY BOTH NEED TESTING
app.post("changeProfilePicture", async (req: Request, res: Response) => {
  try {
    const {userId, image} = req.body;

    const result = await changeProfilePicture(userId, image)
    console.log("res:", result)
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating picture");
  }
});
app.post("changeChatPicture", async (req: Request, res: Response) => {
  try {
    const {chatId, image} = req.body;
    const result = await changeChatPicture(chatId, image);
    console.log("res:", result)
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating picture");
  }
});

app.get("/getMatchingUser/:inputString", (req: Request, res: Response) => {
  // will have to send chatId in request
  const {inputString} = req.params;
  // if(!inputString) return null
  const promGetMessagesByChatId = new Promise((resolve, reject) => {
    resolve(getMatchingUser(inputString));
  });
  promGetMessagesByChatId.then((result: any[]) => {
    res.send({result});
  })  
})

io.on("connection", function(socket) {
  // join a chat room when the client sends a 'join_room' event
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
  });

  socket.on("send_message", async (arg) => {
    try {
      const newMessage = await sendMessage(arg);
      // emit the new message to all sockets in the room
      io.to(arg.chat_id).emit("new_message", newMessage);
    } catch (error) {
      console.error(error);
    }
  });
});

io.on("User", (socket: socketio.Socket) =>{
  console.log("User Online");
})

const server = http.listen(8080, function() {
  console.log("listening on *:8080");
});

  // TO HASH ALL PASSWORDS IN DB
/*   const hashAllPasswords = async () => {
    try {
      // Get all users
      const [users] = await connection.execute('SELECT * FROM users');
    
      for (let user of users) {
        // Ignore users without a password
        if (!user.password) {
          console.warn(`User with id ${user.id} does not have a password set.`);
          continue;
        }
        
        // Hash each user's password
        const hashedPassword = getHashedPassword(user.password);
        
        // Update the user's password in the database
        await connection.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
      }
  
      console.log('Passwords updated successfully');
    } catch (error) {
      console.error('Failed to hash passwords', error);
    }
  };
  hashAllPasswords(); */