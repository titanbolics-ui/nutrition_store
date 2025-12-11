export async function getBtcRateInUsd(): Promise<number> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
    );

    const data = await response.json();
    return data.bitcoin.usd;
  } catch (error) {
    console.error("Failed to fetch BTC rate:", error);
    throw new Error("Crypto Oracle is down");
  }
}
