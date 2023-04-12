import Binance from "node-binance-api";
import dotenv from "dotenv";
import http from 'http';
import { maintainArr, getPriceDirection } from './functions.js';
dotenv.config();


const binance = new Binance().options({
  APIKEY: process.env.API_KEY,
  APISECRET: process.env.API_SECRET,
});
export const IterationTime = 1;//one second
const coolDownProfit = (900 / IterationTime);//5 minutes
const coolDownLoss = (900 / IterationTime);//15 minutes
const desireProfitPercentage = 2;
const totalPNL = 0;
let ProfitableTrades = 0;
let lossTrades = 0;

let InstrumentRecharge = { BTCUSDT: [{ cooldown: false, buyPrice: 0, sellPrice: 0, ticksLeft: 0, result: 'None' }, { cooldown: false, buyPrice: 0, sellPrice: 0, ticksLeft: 0, result: 'None' }], ETHUSDT: [{ cooldown: false, buyPrice: 0, sellPrice: 0, ticksLeft: 0, result: 'None' }, { cooldown: false, buyPrice: 0, sellPrice: 0, ticksLeft: 0, result: 'None' }], LTCUSDT: [{ cooldown: false, buyPrice: 0, sellPrice: 0, ticksLeft: 0, result: 'None' }, { cooldown: false, buyPrice: 0, sellPrice: 0, ticksLeft: 0, result: 'None' }] };
let BTCPrice = [];
let ETHPrice = [];
let LTCPrice = [];




function onCoolDown(symbol, side) {
  console.log(symbol, side);
  if (symbol == 'BTCUSDT' && side == 'long') {
    return InstrumentRecharge.BTCUSDT[0].cooldown;
  }
  if (symbol == 'BTCUSDT' && side == 'short') {
    return InstrumentRecharge.BTCUSDT[1].cooldown;
  }
}


function tradeComplete(symbol, side, buyPrice, sellPrice, result, desireProfit) {

  totalPNL += desireProfit;
  console.log(totalPNL);
  if (result == "LOSS") {
    lossTrades++;
    console.log('The trade resulted in a loss.!')
    if (symbol == 'BTCUSDT' && side == 'long') {
      InstrumentRecharge.BTCUSDT[1].cooldown = true;
      InstrumentRecharge.BTCUSDT[1].buyPrice = buyPrice;
      InstrumentRecharge.BTCUSDT[1].sellPrice = sellPrice;
      InstrumentRecharge.BTCUSDT[1].ticksLeft = coolDownLoss;
      InstrumentRecharge.BTCUSDT[1].result = result;
    }
    if (symbol == 'BTCUSDT' && side == 'short') {
      InstrumentRecharge.BTCUSDT[0].cooldown = true;
      InstrumentRecharge.BTCUSDT[0].buyPrice = buyPrice;
      InstrumentRecharge.BTCUSDT[0].sellPrice = sellPrice;
      InstrumentRecharge.BTCUSDT[0].ticksLeft = coolDownLoss;
      InstrumentRecharge.BTCUSDT[0].result = result;
    }
    //Other Instruments
  }
  else {
    ProfitableTrades++;
    console.log('The trade resulted in a profit.!')
    console.log('Profit: ', desireProfit);

    if (symbol == 'BTCUSDT' && side == 'long') {
      InstrumentRecharge.BTCUSDT[0].cooldown = true;
      InstrumentRecharge.BTCUSDT[0].buyPrice = buyPrice;
      InstrumentRecharge.BTCUSDT[0].sellPrice = sellPrice;
      InstrumentRecharge.BTCUSDT[0].ticksLeft = coolDownProfit;
      InstrumentRecharge.BTCUSDT[0].result = result;
    }
    if (symbol == 'BTCUSDT' && side == 'short') {
      InstrumentRecharge.BTCUSDT[1].cooldown = true;
      InstrumentRecharge.BTCUSDT[1].buyPrice = buyPrice;
      InstrumentRecharge.BTCUSDT[1].sellPrice = sellPrice;
      InstrumentRecharge.BTCUSDT[1].ticksLeft = coolDownProfit;
      InstrumentRecharge.BTCUSDT[1].result = result;
    }
    //Other Instruments
  }
}







async function resetCoolDown() {



  //long
  if (InstrumentRecharge.BTCUSDT[0].cooldown) {
    let btcPrice = await getInstrumentPrice('BTCUSDT');
    console.log('ResetCoolDown BTC PRICE: ', btcPrice);
    (InstrumentRecharge.BTCUSDT[0].ticksLeft > 0) ? InstrumentRecharge.BTCUSDT[0].ticksLeft-- : null;
    if (InstrumentRecharge.BTCUSDT[0].ticksLeft == 0) {
      InstrumentRecharge.BTCUSDT[0].cooldown = false;
      return;
    }


    if (InstrumentRecharge.BTCUSDT[0].result == "LOSS") {
      if (btcPrice <= InstrumentRecharge.BTCUSDT[0].buyPrice) {
        InstrumentRecharge.BTCUSDT[0].cooldown = false
        InstrumentRecharge.BTCUSDT[0].ticksLeft = 0;
        return;
      }
    }
    else {
      let diff = (InstrumentRecharge.BTCUSDT[1].buyPrice - InstrumentRecharge.BTCUSDT[1].sellPrice) / 1.75;
      if (btcPrice <= diff + InstrumentRecharge.BTCUSDT[0].buyPrice) {
        InstrumentRecharge.BTCUSDT[0].cooldown = false
        InstrumentRecharge.BTCUSDT[0].ticksLeft = 0;
        return;
      }
    }
  }
  //Short
  if (InstrumentRecharge.BTCUSDT[1].cooldown) {
    let btcPrice = await getInstrumentPrice('BTCUSDT');
    console.log('ResetCoolDown BTC PRICE: ', btcPrice);
    (InstrumentRecharge.BTCUSDT[1].ticksLeft > 0) ? InstrumentRecharge.BTCUSDT[1].ticksLeft-- : null;
    if (InstrumentRecharge.BTCUSDT[1].ticksLeft == 0) {
      InstrumentRecharge.BTCUSDT[1].cooldown = false;
      return;
    }
    if (InstrumentRecharge.BTCUSDT[1].result == "LOSS") {
      if (btcPrice >= InstrumentRecharge.BTCUSDT[1].buyPrice) {
        InstrumentRecharge.BTCUSDT[1].cooldown = false
        InstrumentRecharge.BTCUSDT[1].ticksLeft = 0;
        return;
      }
    }
    else {
      let diff = (InstrumentRecharge.BTCUSDT[1].buyPrice - InstrumentRecharge.BTCUSDT[1].sellPrice) / 1.75;
      if (btcPrice >= InstrumentRecharge.BTCUSDT[1].buyPrice) {
        InstrumentRecharge.BTCUSDT[1].cooldown = false
        InstrumentRecharge.BTCUSDT[1].ticksLeft = 0;
      }
    }
  }



}


async function updatePrice(symbol, price) {
  if (symbol == "BTCUSDT") {
    maintainArr(BTCPrice, parseFloat(price));
  }
  else if (symbol == "ETHUSDT") {
    maintainArr(ETHPrice, parseFloat(price));
  }
  else if (symbol == "LTCUSDT") {
    maintainArr(LTCPrice, parseFloat(price));
  }
}


function getPriceArr(symbol) {
  if (symbol == "BTCUSDT") {
    return BTCPrice
  }
  else if (symbol == "ETHUSDT") {
    return ETHPrice;
  }
  else if (symbol == "LTCUSDT") {
    return LTCPrice;
  }
}




let engineFlag = true;
export async function _tradeEngine() {
  resetCoolDown();

  try {
    let totalInstruments = [];
    await getPositionData().then(async _data => {
      await getTradeInfo().then(async InsInfo => {
        const parsedIns = JSON.parse(InsInfo);
        if (engineFlag) {
          _data.positions.forEach(async instruments => {
            // console.log('------Positions Block----')
            totalInstruments.push(instruments);
            updatePrice(instruments.symbol, instruments.markPrice)
            let totalFee = getFees({ tradeAmount: instruments.positionAmt, price: instruments.entryPrice });
            let side = getType(instruments.positionAmt);
            let desireProfit = await checkDesireProfit({ symbol: instruments.symbol, side: side, tradeAmount: Math.abs(instruments.positionAmt), leverage: instruments.leverage, markPrice: instruments.markPrice, price: instruments.entryPrice }, totalFee);
            console.log('PNL: ', desireProfit.profitable, ' Profit Percentage: ', desireProfit.profitPercentage, 'PNL: ', desireProfit.pnl);
            if (desireProfit.profitable) {//if true then close the trade...
              engineFlag = false;
              let prvTrade = await settlePreviousTrade({ side: side, tradeAmount: Math.abs(instruments.positionAmt), symbol: instruments.symbol });
              if (prvTrade["symbol"] == instruments.symbol) {//confirmed closed
                tradeComplete(instruments.symbol, side, instruments.entryPrice, instruments.markPrice, "PROFITABLE", desireProfit.pnl);  //Now update that we have completed the trade
                engineFlag = true;
              }
              else {
                console.log('The previous trade could not be closed!');
                engineFlag = true;
              }
            }
            else {
              //BlackFlag
              let signalInstrument;
              parsedIns.forEach(element => {
                if (element.symbol == instruments.symbol)
                  signalInstrument = element;
              });

              let signalSide = getSellFlag(signalInstrument.flags);
              if (signalSide != undefined) {
                if (blackFlag(side, signalSide)) {
                  engineFlag = false;
                  let prvTrade = await settlePreviousTrade({ side: side, tradeAmount: Math.abs(instruments.positionAmt), symbol: instruments.symbol });
                  if (prvTrade["symbol"] == instruments.symbol) {//confirmed closed
                    tradeComplete(instruments.symbol, side, instruments.entryPrice, instruments.markPrice, "LOSS", desireProfit.pnl);
                    engineFlag = true;
                  }
                  else {
                    console.log('The previous trade could not be closed!');
                    engineFlag = true;
                    return;
                  }
                }
                else {
                  console.log('The profit margin is not sufficient!');
                }
              } else {
                //console.log('Unbalanced flags detected!');
              }
            }
          });
          // console.log('------Trade starting Block----')
          //------Trade starting Area
          console.log(totalInstruments.length);
          for (let i = 0; i < parsedIns.length; i++) {
            let exits = false;
            for (let u = 0; u < totalInstruments.length; u++) {
              if (parsedIns[i].symbol == totalInstruments[u].symbol) {
                exits = true;
              }
            }
            if (exits) {
              //Do nothing
              // console.log('Already trade placed!');
              // console.log('------End Trade starting Block----')
            } else {
              let side = getBuyFlag(parsedIns[i].flags);
              if (side != undefined) {
                if (!onCoolDown(parsedIns[i].symbol, side)) {
                  let price = await getInstrumentPrice(parsedIns[i].symbol);
                  let positionAmt = parsedIns[i].positionAmt;
                  let leverageAmt = parsedIns[i].leverageAmt;
                  let tradeAmt = ((positionAmt * leverageAmt) / price).toFixed(3);
                  let _setLeverage = await setLeverage({ symbol: parsedIns[i].symbol, leverage: leverageAmt });
                  if (_setLeverage["leverage"] == leverageAmt) {
                    let newTrade = await CreateNewTrade({ side: side, tradeAmount: tradeAmt, symbol: parsedIns[i].symbol });
                    engineFlag = false;
                    console.log(newTrade);
                    if (newTrade["symbol"] == parsedIns[i].symbol) {//successfully created new trade
                      engineFlag = true;
                    } else {
                      throw ('unable to place trade');
                    }
                  } else {
                    throw ('unable to set leverage');
                  }
                } else {
                  console.log('Instrument on coolDown wait please');
                }
              }
              else {
                // console.log('Unbalanced flags detected');
              }
            }
          }
        } else {
          console.log('Process Pending!');
        }
      });
    });
  }
  catch (error) {
    console.log(error);
    engineFlag = true;
  }
  logs();
}


function logs() {
  console.log('lost trades are : ', lossTrades);
  console.log('Profitable number of trades: ', ProfitableTrades);
  console.log('Total PNL: ', totalPNL);
}


async function getTradeInfo() {
  return new Promise(async (resolve, reject) => {
    const options = {
      hostname: '3.10.246.161',
      port: 80,
      path: '/getsignals',
      method: 'GET'
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.end();
  });
}







async function getInstrumentPrice(symbol) {
  return new Promise(async (resolve, reject) => {
    try {
      let value = await binance.futuresPrices()
      const BTCUSDTValue = value.BTCUSDT;
      resolve(BTCUSDTValue);
    } catch (error) {
      reject(undefined);
    }
  });
}



async function setLeverage(instrument) {
  try {
    return await binance.futuresLeverage(instrument.symbol, instrument.leverage);
  } catch (error) {
    console.log(error);
  }
}


async function settlePreviousTrade(instrument) {
  return new Promise(async (resolve, reject) => {
    if (instrument.side == "long") {
      resolve(
        await binance.futuresMarketSell(instrument.symbol, instrument.tradeAmount)
      );
    } else {
      resolve(
        await binance.futuresMarketBuy(instrument.symbol, instrument.tradeAmount)
      );
    }
  });
}


async function CreateNewTrade(Instrument) {
  return new Promise(async (resolve, reject) => {
    console.log(Instrument);
    if (Instrument.side == "long") {
      resolve(
        await binance.futuresMarketBuy(Instrument.symbol, Instrument.tradeAmount)
      );
    } else if (Instrument.side == "short") {
      resolve(
        await binance.futuresMarketSell(Instrument.symbol, Instrument.tradeAmount)
      );
    }
    else {
      console.log('Unable to detect right weight')
      reject(false);
    }
  });
}



function getFees(instrument) {
  console.log(instrument);
  const tradeAmount = Math.abs(instrument.tradeAmount); // Example trade amount in BTC
  const takerFeeRate = 0.0004; // Taker fee 
  const usdtRate = instrument.price; // Example BTC/USDT exchange rate
  let fee = tradeAmount * takerFeeRate;
  const feeInBaseCurrency = fee * usdtRate; // Convert the fee amount to USDT
  return (feeInBaseCurrency * 2);
}



async function checkDesireProfit(instrument, fee) {


  let getCurrentPrice = instrument.markPrice;
  let orignalAmount = (getCurrentPrice * instrument.tradeAmount) / instrument.leverage;
  if (instrument.side == 'long' && instrument.price > 0) {
    let pnl = (((getCurrentPrice - instrument.price) * instrument.tradeAmount) - fee);
    let profitPercentage = (pnl / orignalAmount) * 100;
    if (pnl > 0) {
      if (profitPercentage >= desireProfitPercentage) {

        let direction = getPriceDirection(getPriceArr(instrument.symbol));
        if (instrument.side == 'short') {
          if (direction == 'up') {
            return { profitable: true, profitPercentage: profitPercentage, pnl: pnl }
          } else {
            return { profitable: false, profitPercentage: profitPercentage, pnl: pnl }
          }
        }
        else if (instrument.side == 'long') {

          if (direction == 'up') {
            return { profitable: false, profitPercentage: profitPercentage, pnl: pnl }
          } else {
            return { profitable: true, profitPercentage: profitPercentage, pnl: pnl }
          }
        }
        else {
          return { profitable: true, profitPercentage: profitPercentage, pnl: pnl }
        }

      } else {
        return { profitable: false, profitPercentage: profitPercentage, pnl: pnl }
      }
    } else {
      return { profitable: false, profitPercentage: profitPercentage, pnl: pnl }
    }

  } else if (instrument.side == 'short' && instrument.price > 0) {

    let pnl = ((instrument.price - getCurrentPrice) * instrument.tradeAmount - fee);
    let profitPercentage = (pnl / orignalAmount) * 100;
    if (pnl > 0) {

      if (profitPercentage >= desireProfitPercentage) {
        return { profitable: true, profitPercentage: profitPercentage, pnl: pnl }
      } else {
        return { profitable: false, profitPercentage: profitPercentage, pnl: pnl }
      }
    } else {
      return { profitable: false, profitPercentage: profitPercentage, pnl: pnl }
    }
  }
  else {

  }
}



function blackFlag(side, flagSide) {
  if (side != flagSide) {
    return true;
  } else {
    return false;
  }
}



async function getPositionData() {
  let position_data = await binance.futuresPositionRisk(), markets = Object.keys(position_data);
  let Positions = [];
  let counter = 0;
  position_data.forEach(element => {
    if (element.positionAmt != 0) {
      Positions.push(element);
      counter++;
    }
  });
  return { positions: Positions, counter: counter };
}



function getType(value) {
  if (value < 0) {
    return "short";
  } else {
    return "long";
  }
}


function getSellFlag(flags) {
  console.log(flags);
  if (flags[0] == flags[1] && flags[0] == flags[4]) {
    return flags[0];
  }
  else {
    return undefined;
  }
}



function getBuyFlag(flags) {
  console.log(flags);
  if (flags[4] && flags[0]) {
    return flags[4];
  }
  else {
    return undefined;
  }
}


