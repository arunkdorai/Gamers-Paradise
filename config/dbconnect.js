const mongoose = require("mongoose");
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const dbURI = process.env.DBURI;
mongoose.connect(dbURI)
.then(()=>{
  console.log('database connected successfully');
}).catch(err=>{
  console.log(err,'some error occured while connecting db');
});
