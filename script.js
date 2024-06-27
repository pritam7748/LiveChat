const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt=require('bcrypt');
const saltRounds = 10;
const bodyParser = require('body-parser');
const crypto = require('crypto');
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static('public'));

app.use(session({
  secret: 'pritam123', // Change this to a more secure key
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set secure: true if using HTTPS
}));

// Connect to MongoDB
mongoose.connect('mongodb+srv://pritams7748:IHUA2KDpYIcrPRIq@dgtalists.bz1nfkh.mongodb.net/Chat', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}) .then(() => console.log('Connected to MongoDB'))
.catch(err => console.log('Error connecting to MongoDB:', err));



// Define a schema and model for chat messages
const chatSchema = new mongoose.Schema({
  from:String,
  to:String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});
const usersSchema = new mongoose.Schema({
  _id:String,
  name: String,
  password: String,
  email: String,
  timestamp: { type: Date, default: Date.now }
});



const Users=mongoose.model('users',usersSchema);

const Chat = mongoose.model('Chat', chatSchema);

function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  } else {
    res.redirect('/login');
  }
}

function generateRandomId(length) {
  return crypto.randomBytes(length).toString('hex');
}

// Render the main page
app.get('/', isAuthenticated, async (req, res) => {;

  const clickedUserId=req.query.clickedUserId;
  const currentId=req.query.currentId;
  if (clickedUserId && currentId) {
    let messages = await Chat.find().sort({ timestamp: 1 });
  res.render('index', { messages, clickedUserId, currentId });
  } else {
    res.redirect(`/`);
  }
});
app.get('/signup', async (req, res) => {
  res.render('signup');
});
app.get('/login', async (req, res) => {
  res.render('login');
});

let currentId='';
let otherUserId='';


app.get('/users',isAuthenticated, async (req, res) => {
  const user=await Users.find().lean();
  const id = req.session.userId;
  currentId= req.session.userId;
  res.render('users', {user , id});
});

app.get('/users/:userId', (req, res) => {
  const clickedUserId = req.params.userId;
  otherUserId=clickedUserId;
  const currentId = req.session.userId;
  res.redirect(`/?clickedUserId=${clickedUserId}&currentId=${currentId}`);
});

app.get('/logout', async (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Failed to log out');
    }
    res.send('Logout successful');
  });
});



app.post('/signup', async (req, res) => {
  const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
  try{

    const user = new Users({
      _id:generateRandomId(16),
      name:req.body.username,
      email:req.body.email,
      password:hashedPassword

    })
    const existingUser=await Users.findOne({email:user.email})
    if(!existingUser){

      const data= await user.save();
      res.send('signup success');
    }else{
      res.send('user already exists');
    }
  } catch (err){
    console.log("error", err);
  }
});
app.post('/login', async (req, res) => {
  try{
    const existingUser=await Users.findOne({email:req.body.email});
    if(existingUser){
      const passwordValidation = await bcrypt.compare(req.body.password, existingUser.password);
      if(passwordValidation){
        
        req.session.userId = existingUser._id
        res.redirect('/users');
      }else{
        res.send('wrong password')
      }
    }else{
      res.send('user not exists');
    }



  } catch (err){
    console.log("error", err);
  }
});

io.on('connection', (socket) => {
  console.log('A user connected');

  // Handle incoming chat messages
  socket.on('chat message', async (msg) => {
    const chatMessage = new Chat({ message: msg,from : currentId, to: otherUserId });
    await chatMessage.save();
    io.emit('chat message', msg);
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
