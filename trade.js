import Binance from "node-binance-api";
import dotenv from "dotenv";
dotenv.config();


const binance = new Binance().options({
  APIKEY: process.env.API_KEY,
  APISECRET: process.env.API_SECRET,
});

export let UD = [];
export let tradeCounter = 0;
const desireProfitPercentage = 0.5;





class instrument {
  constructor(symbol, side, tradeAmount, leverage) {
    this.symbol = symbol;
    this.side = side;
    this.tradeAmount = tradeAmount;
    this.currentTrade = false;
    this.leverage = leverage;
    this.flags = ['x', 'x', 'x'];
    this.price = 0;
  }
}

export async function tradeFuture(signal) {
  console.info("signal ", signal);
  if (await checkConnection()) {
    let Instrument = getInstrumentData(signal);
    let instrumentIndex = getInstrumentIndex(Instrument);
    UD[instrumentIndex].flags[signal.flag] = signal.side;
    if (Instrument.currentTrade)//Already trade placed...
    {
      if (blackFlag(Instrument))//close at any loss
      {
        let NewLeverage = setLeverage(signal);

        if (NewLeverage["leverage"] == signal.leverage) {
          let prvTrade = await settlePreviousTrade(Instrument);
          if (prvTrade["symbol"] == Instrument.symbol) {//confirmed closed
            UD[instrumentIndex].currentTrade = false;
            let newTrade = await CreateNewTrade(signal);
            if (newTrade["symbol"] == Instrument.symbol) {//successfully created new trade
              UD[instrumentIndex].side = signal.side;
              UD[instrumentIndex].tradeAmount = signal.tradeAmount;
              UD[instrumentIndex].leverage = signal.leverage;
              UD[instrumentIndex].currentTrade = true;
              UD[instrumentIndex].price = await getInstrumentPrice(signal.symbol);
              console.log('Flipped the trade!');
            } else {//Failed to create new Trade
              console.log('Failed to create new Trade!');
            }
          } else {//failed to close previous trade
            console.log('Failed to close previous Trade!');
          }
        } else {
          console.log('unable to set leverage!');
        }
      }
      else {
        console.log('No reason to close the trade');
      }
    }
    else {//New Trade...
      if (UD[instrumentIndex].flags[0] == signal.side && UD[instrumentIndex].flags[2] == signal.side) {
        let NewLeverage = await setLeverage(signal);
        if (NewLeverage["leverage"] == signal.leverage) {
          let newTrade = await CreateNewTrade(signal);
          console.log(newTrade);
          if (newTrade["symbol"] == Instrument.symbol) {//successfully created new trade
            UD[instrumentIndex].side = signal.side;
            UD[instrumentIndex].tradeAmount = signal.tradeAmount;
            UD[instrumentIndex].leverage = signal.leverage;
            UD[instrumentIndex].currentTrade = true;
            UD[instrumentIndex].price = await getInstrumentPrice(signal.symbol);
            console.log('New trade placed and details are ', newTrade);
          } else {//Failed to create new Trade
            console.log('Failed to create new Trade!');
          }
        } else {
          console.log('Cannot place new trade due to negative flag or flags!');
        }
      } else {
        console.log('unable to set leverage!');
      }
    }
    console.log(UD[instrumentIndex]);
  } else {
    console.log('Unable to connect with exchange!');
  }
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
  console.log('CNT ', Instrument);
  return new Promise(async (resolve, reject) => {
    if (Instrument.side == "long") {
      resolve(
        await binance.futuresMarketBuy(Instrument.symbol, Instrument.tradeAmount)
      );
    } else {
      resolve(
        await binance.futuresMarketSell(Instrument.symbol, Instrument.tradeAmount)
      );
    }
  });
}


export async function close(signal) {
  if (userData.currentTrade) {
    settlePreviousTrade();
    userData.currentTrade = false;
  } else {
    console.log('No Trade to close!');
  }
}



function getInstrumentData(request) {
  for (let i = 0; i < UD.length; i++) {

    if (UD[i].symbol == request.symbol) {
      return UD[i];
    }
  }
  console.log(request);
  let newInstrument = new instrument(request.symbol, request.side, request.tradeAmount, request.leverage);
  UD.push(newInstrument);
  return newInstrument;
}


function getInstrumentIndex(request) {
  for (let i = 0; i < UD.length; i++) {
    if (UD[i].symbol == request.symbol) {
      return i;
    }
  }
  return undefined;
}

export function resetBot() {
  UD = [];
}

async function checkConnection() {
  return new Promise(async (resolve, reject) => {
    binance.prevDay("BTCUSDT", (error, prevDay) => {
      if (error) {
        console.error(error);
        reject(false);
      } else {
        console.log('Connection checked 100%');
        resolve(true);
      }
    });
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


function getFees(instrument) {
  const tradeAmount = instrument.tradeAmount; // Example trade amount in BTC
  const takerFeeRate = 0.0004; // Taker fee 
  const usdtRate = instrument.price; // Example BTC/USDT exchange rate
  let fee = tradeAmount * takerFeeRate;
  const feeInBaseCurrency = fee * usdtRate; // Convert the fee amount to USDT
  return (feeInBaseCurrency * 2);
}


async function checkDesireProfit(instrument, fee) {

  let getCurrentPrice = await getInstrumentPrice(instrument.symbol);
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




function blackFlag(Instrument) {
  if (Instrument.side == 'long') {
    if (Instrument.flags[0] == 'short', Instrument.flags[1] == 'short', Instrument.flags[2] == 'short') {
      return true;
    }
    else {
      return false;
    }
  } else if (Instrument.side == 'short') {
    if (Instrument.flags[0] == 'long', Instrument.flags[1] == 'long', Instrument.flags[2] == 'long') {
      return true;
    }
    else {
      return false;
    }
  } else {
    console.log('Unexpected error!');
    return false;
  }
}



function cleanInstrument(index) {
  UD.splice(index, 1);
}


export async function tradeEngine() {
  tradeCounter = 0;
  for (let i = 0; i < UD.length; i++) {
    if (UD[i].currentTrade) {
      tradeCounter++;
      let totalFee = getFees(UD[i]);
      let desireProfit = await checkDesireProfit(UD[i], totalFee);
      console.log('SYMBOL: ', UD[i].symbol, ' CURRENT PNL: ', desireProfit.pnl, ' in percentage:', desireProfit.profitPercentage, '% Fee ', totalFee, ' leverage: ', UD[i].leverage);
      if (desireProfit.profitable) {//if true then close the trade...
        UD[i].currentTrade = false;
        let prvTrade = await settlePreviousTrade(UD[i]);
        if (prvTrade["symbol"] == UD[i].symbol) {//confirmed closed
          console.log('The trade resulted in a profit.!')
        }
        else {
          console.log('The previous trade could not be closed!');
          UD[i].currentTrade = true;
        }
      } else {
        console.log('The profit margin is not sufficient!');
      }
    } else {
      console.log('There are currently no trade in the queue.');
    }
  }
}