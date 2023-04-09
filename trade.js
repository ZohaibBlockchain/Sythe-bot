import Binance from "node-binance-api";
import dotenv from "dotenv";
import http from 'http';
dotenv.config();


const binance = new Binance().options({
  APIKEY: process.env.API_KEY,
  APISECRET: process.env.API_SECRET,
});

const desireProfitPercentage = 1.5;


let InstrumentRecharge = { BTCUSDT: [{ cooldown: false, buyPrice: 0, sellPrice: 0, ticksLeft: 0 }, { cooldown: false, buyPrice: 0, sellPrice: 0, ticksLeft: 0 }], ETHUSDT: [{ cooldown: false, buyPrice: 0, sellPrice: 0, ticksLeft: 0 }, { cooldown: false, buyPrice: 0, sellPrice: 0, ticksLeft: 0 }], LTCUSDT: [{ cooldown: false, buyPrice: 0, sellPrice: 0, ticksLeft: 0 }, { cooldown: false, buyPrice: 0, sellPrice: 0, ticksLeft: 0 }] }


function onCoolDown(symbol, side) {

  if (symbol == 'BTCUSDT' && side == 'long') {
    return InstrumentRecharge.BTCUSDT[0].cooldown;
  }
  if (symbol == 'BTCUSDT' && side == 'short') {
    return InstrumentRecharge.BTCUSDT[1].cooldown;
  }
}


function tradeComplete(symbol, side, buyPrice, sellprice) {

  if (symbol == 'BTCUSDT' && side == 'long') {
    InstrumentRecharge.BTCUSDT[0].cooldown = true;
    InstrumentRecharge.BTCUSDT[0].buyPrice = buyPrice;
    InstrumentRecharge.BTCUSDT[0].sellPrice = sellprice;
    InstrumentRecharge.BTCUSDT[0].ticksLeft = 300;
  }
  if (symbol == 'BTCUSDT' && side == 'short') {
    InstrumentRecharge.BTCUSDT[1].cooldown = true;
    InstrumentRecharge.BTCUSDT[1].buyPrice = buyPrice;
    InstrumentRecharge.BTCUSDT[1].sellPrice = sellprice;
    InstrumentRecharge.BTCUSDT[0].ticksLeft = 300;
  }
}

async function resetCoolDown() {
  let btcPrice = await getInstrumentPrice('BTCUSDT');

  if (InstrumentRecharge.BTCUSDT[0].cooldown) {
    (InstrumentRecharge.BTCUSDT[0].ticksLeft > 0) ? InstrumentRecharge.BTCUSDT[0].ticksLeft-- : null;
    (InstrumentRecharge.BTCUSDT[0].ticksLeft == 0) ? InstrumentRecharge.BTCUSDT[0].cooldown = false : null;
    let diff = (InstrumentRecharge.BTCUSDT[0].sellPrice - InstrumentRecharge.BTCUSDT[0].buyPrice) / 2;
    if (btcPrice <= diff + InstrumentRecharge.BTCUSDT[0].buyPrice) {
      InstrumentRecharge.BTCUSDT[0].cooldown = false
      InstrumentRecharge.BTCUSDT[0].ticksLeft = 0;
    }

  }
  if (InstrumentRecharge.BTCUSDT[1].cooldown) {
    (InstrumentRecharge.BTCUSDT[1].ticksLeft > 0) ? InstrumentRecharge.BTCUSDT[1].ticksLeft-- : null;
    (InstrumentRecharge.BTCUSDT[1].ticksLeft == 0) ? InstrumentRecharge.BTCUSDT[1].cooldown = false : null;
    let diff = (InstrumentRecharge.BTCUSDT[1].buyPrice - InstrumentRecharge.BTCUSDT[1].sellPrice) / 2;
    if (btcPrice >= diff + InstrumentRecharge.BTCUSDT[1].buyPrice) {
      InstrumentRecharge.BTCUSDT[1].cooldown = false
      InstrumentRecharge.BTCUSDT[1].ticksLeft = 0;
    }
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
            console.log('------Positions Block----')
            totalInstruments.push(instruments);
            let totalFee = getFees({ tradeAmount: instruments.positionAmt, price: instruments.entryPrice });
            let side = getType(instruments.positionAmt);
            let desireProfit = await checkDesireProfit({ side: side, tradeAmount: Math.abs(instruments.positionAmt), leverage: instruments.leverage, markPrice: instruments.markPrice, price: instruments.entryPrice }, totalFee);
            console.log('PNL: ', desireProfit);
            if (desireProfit.profitable) {//if true then close the trade...
              engineFlag = false;

              let prvTrade = await settlePreviousTrade({ side: side, tradeAmount: Math.abs(instruments.positionAmt), symbol: instruments.symbol });
              if (prvTrade["symbol"] == instruments.symbol) {//confirmed closed
                console.log('The trade resulted in a profit.!')
                tradeComplete(instruments.symbol, side, instruments.entryPrice, instruments.markPrice);  //Now update that we have completed the trade
                console.log('Profit: ', desireProfit);
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

              let signalSide = getSide(signalInstrument.flags);
              console.log(signalSide.res, '--X');

              if (signalSide.value != undefined) {

                if (blackFlag(side, signalSide.value) && Math.abs(signalSide.res) > 2) {
                  engineFlag = false;
                  let prvTrade = await settlePreviousTrade({ side: side, tradeAmount: Math.abs(instruments.positionAmt), symbol: instruments.symbol });
                  if (prvTrade["symbol"] == instruments.symbol) {//confirmed closed
                    console.log('The trade resulted in a loss.!')
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
                console.log('balanced flags detected--');
              }
            }

          });
          console.log('------Trade starting Block----')


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
              console.log('Already trade placed!');
              console.log('------End Trade starting Block----')
            } else {
              let side = getSide(parsedIns[i].flags);

              if (side.value != undefined) {

                if (!onCoolDown(parsedIns[i].symbol, side)) {
                  let price = await getInstrumentPrice(parsedIns[i].symbol);
                  let positionAmt = parsedIns[i].positionAmt;
                  let leverageAmt = parsedIns[i].leverageAmt;
                  let tradeAmt = ((positionAmt * leverageAmt) / price).toFixed(3);
                  let _setLeverage = await setLeverage({ symbol: parsedIns[i].symbol, leverage: leverageAmt });
                  if (_setLeverage["leverage"] == leverageAmt) {
                    let newTrade = await CreateNewTrade({ side: side.value, tradeAmount: tradeAmt, symbol: parsedIns[i].symbol });
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

                }
              }
              else {
                console.log('balanced flags detected');
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
    binance.prevDay(symbol, (error, prevDay) => {
      if (error) {
        console.error(error);
        reject(undefined);
      } else {
        resolve(prevDay.lastPrice);
      }
    });
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
        return { profitable: true, profitPercentage: profitPercentage, pnl: pnl }
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
  if (side == flagSide) {
    return false;
  }
  else {
    return true;
  }
}























async function getInstrumentDetail(symbol) {
  return new Promise(async (resolve, reject) => {
    try {
      let position_data = await binance.futuresPositionRisk(), markets = Object.keys(position_data);
      position_data.forEach(instrument => {
        if (instrument.symbol == symbol)
          resolve(instrument);
      });
    } catch (error) {
      reject(error);
    }
  });

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



//weights
//flag 0 = 1,flag 1 = 2,flag 2 = 2 ,flag 3 = 2,flag 4 = 3
//long +
//short -


function getSide(flags) {

  let flag0 = (flags[0] == 'long' ? 1 : -1);
  let flag1 = (flags[1] == 'long' ? 2 : -2);
  let flag2 = (flags[2] == 'long' ? 2 : -2);
  let flag3 = (flags[3] == 'long' ? 2 : -2);
  let flag4 = (flags[4] == 'long' ? 3 : -3);
  let res = flag0 + flag1 + flag2 + flag3 + flag4;
  if (res == 0) {
    return { value: undefined, res };
  }
  else if (res > 0) {
    return { value: 'long', res };
  }
  else if (res < 0) {
    return { value: 'short', res };
  }
}
// let x = ['long','long','short','short','long'];
// console.log(getSide(x));