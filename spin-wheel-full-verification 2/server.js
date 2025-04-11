
const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

const burner = "EH1UKhLL9MTny9sCCGGrzVrbBAVAL6V3XsBXZvQ4wfe8";
const blu = "EWJZQLXkTfEzXxC3LgzZgTJiH6pY82xtLYnc3i5U2ZRV";
const heliusKey = "7221ed6f-db18-4945-a625-df4d006875b1";

app.use(express.json());
app.use(express.static('public'));

app.post('/verify', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet || wallet.length < 32) return res.status(400).json({ ok: false, error: 'Invalid wallet' });

  try {
    const now = Math.floor(Date.now() / 1000);
    // Solscan
    try {
      const solscanRes = await fetch(`https://public-api.solscan.io/account/splTransfers?account=${burner}&limit=200`, {
        headers: { accept: "application/json" }
      });
      const solscanData = await solscanRes.json();

      const solMatch = solscanData.data.find(tx =>
        tx.changeType === "dec" &&
        tx.tokenAddress === blu &&
        tx.tx.from === wallet &&
        Number(tx.amount) >= 2000000000000 &&
        now - tx.blockTime <= 300
      );

      if (solMatch) return res.json({ ok: true, source: "solscan" });
    } catch (err) {
      console.log("Solscan failed:", err.message);
    }

    // Helius fallback
    const heliusRes = await fetch(`https://api.helius.xyz/v0/addresses/${burner}/transactions?api-key=${heliusKey}&type=TRANSFER`);
    const txs = await heliusRes.json();

    const heliusMatch = txs.find(tx =>
      tx.type === "TRANSFER" &&
      tx.tokenTransfers?.some(t =>
        t.toUserAccount === burner &&
        t.fromUserAccount === wallet &&
        t.mint === blu &&
        Number(t.amount) >= 2000000000000 &&
        now - Math.floor(new Date(tx.timestamp).getTime() / 1000) <= 300
      )
    );

    if (heliusMatch) return res.json({ ok: true, source: "helius" });

    return res.json({ ok: false });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`Verifier running on ${PORT}`));
