import { Card } from '../types/card.type';

export async function getCardListFromId(series: string) {
  const url = 'https://en.onepiece-cardgame.com/cardlist/';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    body: new URLSearchParams({
      series: series,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const html = await response.text();

  // Parse delle carte
  const cards = parseCards(html);

  return cards;
}

function parseCards(html: string): Card[] {
  const cards: Card[] = [];

  // Regex per estrarre ogni blocco <dl class="modalCol">
  const cardRegex = /<dl class="modalCol"[^>]*>([\s\S]*?)<\/dl>/gi;
  let match;

  while ((match = cardRegex.exec(html)) !== null) {
    const cardHtml = match[1];

    if (!cardHtml) continue;

    // Estrai i dati
    const idMatch = cardHtml.match(/<span>([^<]+)<\/span>\s*\|\s*<span>([^<]+)<\/span>\s*\|\s*<span>([^<]+)<\/span>/);
    const nameMatch = cardHtml.match(/<div class="cardName">([^<]+)<\/div>/);
    const imageMatch = cardHtml.match(/data-src="([^"]+)"/);
    const costMatch = cardHtml.match(/<div class="cost"><h3>Cost<\/h3>([^<]+)<\/div>/);
    const attributeMatch = cardHtml.match(/<div class="attribute">[\s\S]*?<i>([^<]+)<\/i>/);
    const powerMatch = cardHtml.match(/<div class="power"><h3>Power<\/h3>([^<]+)<\/div>/);
    const counterMatch = cardHtml.match(/<div class="counter"><h3>Counter<\/h3>([^<]+)<\/div>/);
    const colorMatch = cardHtml.match(/<div class="color"><h3>Color<\/h3>([^<]+)<\/div>/);
    const blockMatch = cardHtml.match(/<div class="block"><h3>Block[\s\S]*?<\/h3>([^<]+)<\/div>/);
    const featureMatch = cardHtml.match(/<div class="feature"><h3>Type<\/h3>([^<]+)<\/div>/);
    const effectMatch = cardHtml.match(/<div class="text"><h3>Effect<\/h3>([\s\S]*?)<\/div>/);
    const cardSetsMatch = cardHtml.match(/<div class="getInfo"><h3>Card Set\(s\)<\/h3>([^<]+)<\/div>/);

    cards.push({
      id: idMatch?.[1]?.trim() || '',
      rarity: idMatch?.[2]?.trim() || '',
      type: idMatch?.[3]?.trim() || '',
      name: nameMatch?.[1]?.trim() || '',
      imageUrl: imageMatch?.[1] ? `https://en.onepiece-cardgame.com${imageMatch[1]}` : '',
      cost: costMatch?.[1]?.trim() || '',
      attribute: attributeMatch?.[1]?.trim() || '',
      power: powerMatch?.[1]?.trim() || '',
      counter: counterMatch?.[1]?.trim() || '',
      color: colorMatch?.[1]?.trim() || '',
      blockIcon: blockMatch?.[1]?.trim() || '',
      cardType: featureMatch?.[1]?.trim() || '',
      effect: effectMatch?.[1]?.trim().replace(/<[^>]*>/g, '') || '',
      cardSets: cardSetsMatch?.[1]?.trim() || '',
    });
  }

  return cards;
}
