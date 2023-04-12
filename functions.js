export function maintainArr(arr, newElem) {
    if (arr.length >= 120) {
        arr.shift();
    }
    arr.push(newElem);
}


export function getPriceDirection(lastSecPrices) {
    if (lastSecPrices.length == 300) {
        const avgPrice = lastSecPrices.reduce((total, price) => total + price, 0) / lastSecPrices.length;
        const currentPrice = lastSecPrices[lastSecPrices.length - 1];
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

