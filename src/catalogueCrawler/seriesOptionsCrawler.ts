export async function getSeriesOptions() {
  const url = 'https://en.onepiece-cardgame.com/cardlist/?series=569114';

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      Connection: 'keep-alive',
    },
  });
  const html = await response.text();

  const selectMatch = html.match(/<select[^>]*id=["']series["'][^>]*>([\s\S]*?)<\/select>/i);
  if (!selectMatch) {
    throw new Error('Series select element not found');
  }

  const optionsHtml = selectMatch[1] ?? '';
  const optionRegex = /<option\s+value=["'](\d+)["'][^>]*>([^<]+)<\/option>/gi;

  const seriesOptions: { id: string; name: string }[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = optionRegex.exec(optionsHtml)) !== null) {
    seriesOptions.push({ id: match[1]!, name: match[2]! });
  }

  return seriesOptions;
}
