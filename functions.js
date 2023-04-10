export function maintain30(arr, newElem) {
    if (arr.length >= 30) {
        arr.shift();
    }
    arr.push(newElem);
}


export function getPriceDirection(last30secPrices) {
    if (last30secPrices.length == 30) {
        const avgPrice = last30secPrices.reduce((total, price) => total + price, 0) / last30secPrices.length;
        const currentPrice = last30secPrices[last30secPrices.length - 1];
        if (currentPrice > avgPrice) {
            return 'up';
        } else if (currentPrice < avgPrice) {
            return 'down';
        } else {
            return 'flat';
        }
    }
    else {
        return 'flat';
    }
}

