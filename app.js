const express = require("express");
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
var nodemailer = require('nodemailer');
const mongoose = require("mongoose");
const http = require("http");
const {Server} = require("socket.io");
const { error } = require("console");



const app = express();
const uri = "mongodb://localhost:27017";
const server = http.createServer(app)
const port = 5000;
const ip = "localhost";
const io = new Server(server);


const transporter = nodemailer.createTransport({port: 465,host: "smtp.gmail.com",auth: {user: 'darkstarexist@gmail.com',pass: 'nvoi qiry snib abqx'},secure: true});

let rooms = []; //add {socket.id:username}
let users = {};

//functions

function randomcode() {
	let pass = '';
	let str = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
		'abcdefghijklmnopqrstuvwxyz0123456789@#$';

	for (let i = 1; i <= 8; i++) {
		let char = Math.floor(Math.random()* str.length + 1);

		pass += str.charAt(char)
	}

	return pass;
}




//socketio server
io.on("connection",(socket)=>{
    let roomcode = randomcode()
    socket.join(roomcode);
    rooms.push({roomcode:{}});
    console.log(`room joined : ${roomcode}`);
    socket.emit("roomjoined",({roomcode:roomcode}));

    socket.on("user-joined",(data)=>{
        users[data.id] = data.name;
        console.log(users);
    })

    socket.on("createroom",(data)=>{
        const _code = data.code;
        let _alias = users[data.id];
        if(_alias == ""){
            _alias = "anonymous";
        } 
        socket.join(_code);
        rooms.push({_code});
        io.sockets.in(data.code).emit("joinedroom",{code:data.code,name:_alias});
    })

    socket.on("sendmsg",(data)=>{
        let _msg = data.msg;
        const _code = data.code;
        console.log(`roomname = ${_code}`)
        // io.sockets.to(_code).emit("roommsg",{msg:_msg});
        socket.broadcast.to(_code).emit("roommsg",{msg:_msg,name:data.name});

    })
})



//mongoose
mongoose.connect(uri).then(()=>{console.log("mongoose connected")}).catch(error,()=>{console.log("Mongoose Error : ",error)})
    
const userschema = new mongoose.Schema({
    username:{
        type: String,
        required : true,
        unique : true
    },
    password:{
        type: String,
        required : true,
    },
    email:{
        type: String,
        required : true,
        unique : true
    },

})

const dataschema = new mongoose.Schema({
    alias:{
        type: String,
        required : true,
    },
    code:{
        type:String,
        required:true,
        unique:true,
    }
})

const User = mongoose.model("User",userschema);
const Data = mongoose.model("Data",dataschema);

app.set("view engine","hbs");
app.use(express.static(path.join(__dirname,"static")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'zxcvbnm12345', resave: true, saveUninitialized: true}));

async function sendmail(from,to,subject,msg){
    const mailData = {
        from: from,  // sender address
          to: to,   // list of receivers
          subject: subject,
          text: "Webiome Message",
          html: msg,
        };
    
    transporter.sendMail(mailData,(err, info) => {
        if(err){
            console.log(err)
        }
    })
}

function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}



app.get("/",(req,res)=>{
    res.render("login");
})

app.post("/",async (req,res)=>{
    const _username = req.body.username;
    const _password = req.body.password;

    let haveuser = await User.findOne({username:_username,password:_password});
    // console.log(haveuser);
    if(haveuser){
        // console.log(`email = ${haveuser.email}`)
        req.session._myemail = haveuser.email;
        res.render("webiome",{name:_username});
    }
    else{
        res.render("login",{error:"Invalid username or password"});
    }

})

app.get("/signup",(req,res)=>{
    res.render("signup");
})

app.post("/signup",async (req,res)=>{
    if(req.body.username == ""){
        res.render("signup",{error:"Invalid username"})
    }
    else if(req.body.email == ""){
        res.render("signup",{error:"Invalid Email id"})
    }
    else if(req.body.password == ""){
        res.render("signup",{error:"Invalid password"})
    }
    else{

        req.session.signname = req.body.username;
        req.session.signpassword = req.body.password;
        req.session.signemail = req.body.email;
        const _rootemail = req.body.email;
        let haveemail = await User.findOne({email:_rootemail})
        // console.log(haveuser);
        // console.log(haveemail);
        if(haveemail){
            res.render("signup",{error:"Username already exist"})
        }
        else{
            res.redirect("/verify");
        }
    }


})

app.get("/verify",(req,res)=>{
    let signemail = req.session.signemail;
    if (signemail == undefined){
        signemail = "";
    }
    if (signemail != "" && signemail.endsWith("@gmail.com")){
        req.session.code = getRndInteger(111111,999999);
        sendmail("darkstarexist@gmail.com",signemail,"Verification code",`your verification code for webiome is ${req.session.code}`);
        res.render("verification",{email:signemail});
    }
    else{
        res.redirect("/signup")
    }
})

app.post("/verify",async (req,res)=>{
    const givencode = req.body.code;
    const sessioncode = req.session.code;
    if(givencode == sessioncode){

        const _username = req.session.signname; 
        const _email = req.session.signemail; 
        const _password = req.session.signpassword; 

        // console.log({username:_username,password:_password,email:_email})

        const result = await User.create({
            username : _username,
            password: _password,
            email : _email,
        })

        console.log("created user profile!")

        req.session.destroy((err)=>{
            res.redirect("/");
        })
    } 
    else{
        res.render("verification",{error:"Invalid verification code"})
    }
})

server.listen(port,ip,()=>{console.log(`app listening on http://${ip}:${port}`)})
