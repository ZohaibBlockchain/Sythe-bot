import express from "express";
const app = express();
const port = 7777;
import { tradeFuture, UD, tradeCounter, resetBot, tradeEngine } from "./trade.js";

import bodyParser from "body-parser";
app.use(bodyParser.json());



app.get("/", (req, res) => {
  res.send("Welcome to the SYTHE AI Bot");
});



app.post("/tradeFuture", (req, res) => {
  const data = req.body;
  tradeFuture(data);
  res.sendStatus(200);
});



app.post("/resetBot", (req, res) => {
  resetBot();
  res.sendStatus(200);
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});


process.on('uncaughtException', function (err) {
  console.log(err);
});


process.on('TypeError', function (err) {
  console.log(err);
});

let DisplayCounter = 0;
function botCore() {
  if (DisplayCounter > 10) {
    console.clear();
    console.log('V1 SYTHE AI Bot +_+ : ');
    console.log('Current Instruments are: ', UD.length);
    console.log('BOT Health 100 % and total number of trade are: ', tradeCounter);
    DisplayCounter = 0;
  }
  DisplayCounter++;
  tradeEngine();
  setTimeout(botCore, 1000);
}

botCore();