// server/app.js
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

require('dotenv').config();

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true, useUnifiedTopology: true
}).then(()=>console.log('MongoDB connected')).catch(err=>console.error(err));

// view engine
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layouts/main'); // uses views/layouts/main.ejs

// static
app.use(express.static(path.join(__dirname, '../public')));

// middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// sessions stored in Mongo
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboardcat',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// attach user to res.locals for EJS access
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// routers (we'll create these)
const authRouter = require('./routers/auth');
const studentRouter = require('./routers/student');
const adminRouter = require('./routers/admin');
const companyRouter = require('./routers/company');

app.use('/', authRouter);
app.use('/student', studentRouter);
app.use('/admin', adminRouter);
app.use('/company', companyRouter);

// generic 404
app.use((req, res) => res.status(404).render('pages/404', { title: 'Not Found' }));

module.exports = app;
