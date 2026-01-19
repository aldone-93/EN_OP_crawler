import { getSeriesOptions } from './seriesOptionsCrawler';
import { getCardListFromId } from './cardListFromId';
import { Card } from './types/card.type';

const fs = require('node:fs');

async function main() {
  const seriesOptions = await getSeriesOptions();
  console.log(seriesOptions);

  const cardList: Card[] = [];

  for (const option of seriesOptions) {
    const cardlist = await getCardListFromId(option.id);
    cardList.push(...cardlist);
  }

  fs.writeFile('./output/cards.json', JSON.stringify(cardList, null, 2), (err: any) => {
    if (err) {
      console.error(err);
    }
  });
}

main();
