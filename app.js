require('dotenv').config();
const express = require('express');
const bodyParser = require("body-parser");
const app = express();


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const mongoose = require("mongoose");
const ejs = require("ejs");
var session = require('express-session');
const passportLocalMongoose = require("passport-local-mongoose");
const MemoryStore = require('memorystore')(session);
const passport = require('passport');
const { google } = require("googleapis");
//const sheets = google.sheets('v4')
const fs = require('fs');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const date = require('./date');






app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set('view engine', 'ejs');



app.use(session({
    cookie: { maxAge: 86400000 },
    store: new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
    }),
    secret: 'secret must be kept secret',
    resave: false,
    saveUninitialized: true,

}));


app.use(passport.initialize());
app.use(passport.session());
//app.use(methodOverride('_method'));

mongoose.connect("mongodb://localhost:27017/attendee", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
});






var Zoom = require("zoomus")({
    key: process.env.ZOOMKEY,
    secret: process.env.ZOOMSECRET
});


////////////////        Schemas   ////////////////////////

var userSchema = new mongoose.Schema({
    username: String,
    password: String
});

var meetingSchema = new mongoose.Schema({
    username: String,
    sheet: String,
    date: String,
    min_time: Number,
    sheetID: String,
    meeting_id: Number,
    host_id: String,
    meeting_name: String,
    flag: Number
});

userSchema.plugin(passportLocalMongoose);
const User = new mongoose.model("User", userSchema);
const Meeting = new mongoose.model("Meetings", meetingSchema);





passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});



//////////////////// google drive api,s  /////////////////////////////



const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);


oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

const drive = google.drive({
    version: 'v3',
    auth: oauth2Client
});

const sheets = google.sheets({
    version: 'v4',
    auth: oauth2Client
});






async function create_sheet(name) {
    try {
        const response = sheets.spreadsheets.create({
            //auth: oauth2Client,
            resource: {
                properties: {
                    title: name
                }
            }
        });
        return response;
    } catch (err) {
        console.log(`The API returned an error: ${err}`);
        return;
    }
}



////////////////////////////////////////////////////////////


app.post('/signup', function(req, res) {
    User.findOne({ username: req.body.username }, function(err, found) {
        if (found) {
            var err = "User Already Exist Please Login";
            res.render('error', { error: err });
        } else {
            User.register({ username: req.body.username, active: false }, req.body.password, function(err, user) {

                if (err) {
                    console.log(err);
                    res.redirect("/signup");
                } else {
                    passport.authenticate("local")(req, res, function() {
                        res.redirect("/home");
                    });
                }
            });
        }
    })

});

app.post('/login', function(req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    req.login(user, function(err) {
        if (err) {
            //return next(err);
            //console.log(err);
            res.send("Incorrect Username or Password");
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/home");
            });
        }
    });
});



app.get('/', function(req, res) {
    //console.log("working");
    //res.send("hello");
    res.redirect('/login');
});

app.get('/login', function(req, res) {
    res.render('login');
});

app.get('/signup', function(req, res) {
    res.render('signup');
});

app.get('/home', function(req, res) {
    //console.log(req.user);
    Meeting.find({ username: req.user.username }, function(err, found) {
        var upc = [];
        var prev = [];
        var currdate = date();
        found.forEach(ele => {
            if (ele.date <= currdate) {
                upc.push(ele);
            } else {
                prev.push(ele);
            }
        })
        res.render('home', { upcoming: upc, previous: prev });
    });
});



app.get('/create', function(req, res) {
    //console.log(req.user);
    res.render('create');
});


app.post('/sheet/:id', async function(req, res) {
    console.log("reacher here because you click");
    var sheetID = req.params.id;
    console.log(req.params.id);
    const doc = new GoogleSpreadsheet(sheetID);
    doc.useOAuth2Client(oauth2Client);
    Meeting.findOne({ sheetID: req.params.id }, async function(err, found) {
        if (found.flag == 0) {
            try {
                await doc.loadInfo();
                const sheet0 = doc.sheetsByIndex[0];
                const sheet = await doc.addSheet({ headerValues: ['user_id', 'user_name', 'in', 'out', 'time_spent', 'flag'] });
                await sheet0.delete();

                found.flag = 1;
                found.save();
            } catch (err) {
                res.send(err);
            }
        }
    });



});

app.post('/class_details', async function(req, res) {

    var response = await create_sheet(req.body.meeting_name);

    // console.log(response);
    // console.log("   ");
    // console.log("For URL");

    //console.log(response);
    console.log('Created a new spreadsheet:')
    var id = response.data.spreadsheetId;
    console.log(id);
    var link = response.data.spreadsheetUrl;
    var meet = new Meeting({
        username: req.user.username,
        sheet: link,
        date: req.body.date,
        min_time: req.body.min_time,
        sheetID: id,
        meeting_id: req.body.meeting_ID,
        //host_id: String,
        meeting_name: req.body.meeting_name,
        flag: 0
    });
    meet.save();
    console.log(req.body.date);
    console.log(date());

    res.redirect('/home');
});


app.get('/delete/:id', function(req, res) {
    Meeting.deleteOne({ _id: req.params.id }, function(err) {
        if (err) {
            res.render('error', { error: "Error while deleting" });
        } else {
            res.redirect('/home');
        }
    })
})


app.post('/student_join', function(req, res) {
    console.log("post request");
    // console.log(req.body);
    // console.log("   ");
    console.log(req.body.payload.object.participant);
    var meeting = req.body.payload.object;
    var participant = req.body.payload.object.participant;
    Meeting.findOne({ meeting_id: meeting.id }, async function(err, found) {
        if (found) {
            try {
                //console.log("found meeting id");
                const doc = new GoogleSpreadsheet(found.sheetID);
                doc.useOAuth2Client(oauth2Client);
                await doc.loadInfo();
                //console.log(doc);
                const sheet = doc.sheetsByIndex[0];
                const rows = await sheet.getRows();
                var length = rows.length;
                var row_found = rows.find(function(element) {
                    return element.user_id == participant.id;
                });

                // console.log("row_found is: ");
                // console.log(row_found);
                // console.log("flag is");
                // console.log(flag);

                if (!row_found) {
                    await sheet.addRow({ user_id: participant.id, user_name: participant.user_name, in: participant.join_time, out: participant.join_time, time_spent: 0 });
                } else {

                    if (row_found.out < participant.join_time) {
                        console.log("user already exists");
                        var time = row_found.time_spent;
                        await row_found.delete();
                        await sheet.addRow({ user_id: participant.id, user_name: participant.user_name, in: participant.join_time, out: participant.join_time, time_spent: time });
                    }
                }
            } catch (err) {
                console.log(`The error: ${err}`);
            }
        }
    });
    //res.redirect('/v2/accounts/' + meeting.account_id + '/meetings/' + meeting.object.id + '/registrants')
});


async function timeSpent(x, y) {
    try {
        console.log("inside timespent function");
        console.log(x);
        var inhr = x.substring(x.length - 7, x.length - 9);
        var inmin = x.substring(x.length - 4, x.length - 6);
        var outhr = y.substring(y.length - 7, y.length - 9);
        var outmin = y.substring(y.length - 4, y.length - 6);
        var time = ((parseInt(outhr) - parseInt(inhr)) * 60) + (parseInt(outmin) - parseInt(inmin));
        console.log(time);
        return time;
    } catch (err) {
        console.log(err);
    }
}


app.post('/student_left', function(req, res) {
    console.log("left request");
    // console.log(req.body);
    // console.log("   ");
    console.log(req.body.payload.object.participant);
    var meeting = req.body.payload.object;
    var participant = req.body.payload.object.participant;
    Meeting.findOne({ meeting_id: meeting.id }, async function(err, found) {
        if (found) {
            try {
                //console.log("found meeting id");
                const doc = new GoogleSpreadsheet(found.sheetID);
                doc.useOAuth2Client(oauth2Client);
                await doc.loadInfo();
                //console.log(doc);
                const sheet = doc.sheetsByIndex[0];
                const rows = await sheet.getRows();
                var length = rows.length;

                var row_found = rows.find(function(element) {
                    return element.user_id == participant.id;
                });


                if (row_found) {
                    if (row_found.out < participant.leave_time) {
                        console.log("user left");
                        row_found.out = participant.leave_time;
                        await row_found.save();
                        var time_spent = await timeSpent(row_found.in, row_found.out);
                        console.log(time_spent);
                        var new_time = parseInt(row_found.time_spent) + time_spent;
                        row_found.time_spent = new_time;
                        await row_found.save();
                        if (row_found.time_spent >= found.min_time) {
                            row_found.flag = 'P';
                            await row_found.save();
                        }
                    }
                }
            } catch (err) {
                res.send(err);
            }
        }
    });
    //res.redirect('/v2/accounts/' + meeting.account_id + '/meetings/' + meeting.object.id + '/registrants')
});





app.listen(80, function(err) {
    console.log("running on port 80");
});