/* ===========================================================================
   DealzTT — Badges / achievements (TalkFreeTT-style).
   Encourages good bidder behaviour: bid, watch, use proxy, win, spend big.
   State is per-browser (localStorage) in DEMO; when the backend is live these
   map to server-side counters on the account. Badges.record(event) is called
   from the bid / watch / win flows and awards + toasts newly earned badges.
   =========================================================================== */
(function () {
  const STATS_KEY = "dealztt_stats";
  const EARNED_KEY = "dealztt_badges";

  const CATALOG = [
    { id: "verified",     ic: "✅", name: "Verified",      tip: "Signed in to DealzTT",                test: (s) => s.signedIn },
    { id: "first-bid",    ic: "🎯", name: "First Bid",     tip: "Placed your first bid",               test: (s) => s.bids >= 1 },
    { id: "active",       ic: "⚡", name: "Active Bidder",  tip: "Placed 5 bids",                       test: (s) => s.bids >= 5 },
    { id: "power",        ic: "🔥", name: "Power Bidder",   tip: "Placed 15 bids",                      test: (s) => s.bids >= 15 },
    { id: "watcher",      ic: "👁", name: "Watchful Eye",  tip: "Added a lot to your watchlist",       test: (s) => s.watches >= 1 },
    { id: "collector",    ic: "📋", name: "Collector",     tip: "Watching 5 lots",                     test: (s) => s.watches >= 5 },
    { id: "proxy",        ic: "🤖", name: "Proxy Pro",     tip: "Used a max (automatic) bid",          test: (s) => s.maxBids >= 1 },
    { id: "sniper",       ic: "🎿", name: "Clutch",        tip: "Bid in the final 2 minutes",          test: (s) => s.clutch >= 1 },
    { id: "big-spender",  ic: "💎", name: "Big Spender",   tip: "Bid over TT$50,000 on a lot",         test: (s) => s.biggestBid >= 50000 },
    { id: "high-roller",  ic: "🏆", name: "High Roller",   tip: "Bid over TT$100,000 on a lot",        test: (s) => s.biggestBid >= 100000 },
    { id: "winner",       ic: "🎉", name: "Winner",        tip: "Won an auction",                      test: (s) => s.wins >= 1 },
    { id: "champion",     ic: "👑", name: "Champion",      tip: "Won 3 auctions",                      test: (s) => s.wins >= 3 },
  ];

  const RANKS = [
    { min: 0,  name: "Newcomer" },
    { min: 2,  name: "Rookie" },
    { min: 4,  name: "Bidder" },
    { min: 6,  name: "Contender" },
    { min: 8,  name: "Pro" },
    { min: 10, name: "Elite" },
    { min: 12, name: "Legend" },
  ];

  function loadStats() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(STATS_KEY) || "{}"); } catch {}
    return Object.assign({ bids: 0, watches: 0, wins: 0, maxBids: 0, clutch: 0, biggestBid: 0, signedIn: false }, s);
  }
  function saveStats(s) { localStorage.setItem(STATS_KEY, JSON.stringify(s)); }
  function loadEarned() { try { return JSON.parse(localStorage.getItem(EARNED_KEY) || "[]"); } catch { return []; } }
  function saveEarned(a) { localStorage.setItem(EARNED_KEY, JSON.stringify(a)); }

  function rankFor(count) {
    let r = RANKS[0];
    for (const rank of RANKS) if (count >= rank.min) r = rank;
    return r.name;
  }

  function evaluate(announce) {
    const s = loadStats();
    if (window.AuctionUi?.isSignedIn?.()) s.signedIn = true;
    saveStats(s);
    const earned = loadEarned();
    const newly = [];
    CATALOG.forEach((b) => {
      if (!earned.includes(b.id) && b.test(s)) { earned.push(b.id); newly.push(b); }
    });
    if (newly.length) saveEarned(earned);
    if (announce && newly.length && window.AuctionUi?.toast) {
      newly.forEach((b) => window.AuctionUi.toast("badge", `Badge unlocked: ${b.name}`, `${b.ic} ${b.tip}`, 5200));
    }
    // fire a refresh event so any visible panel updates
    document.dispatchEvent(new CustomEvent("dealztt:badges"));
    return newly;
  }

  const Badges = {
    stats: loadStats,
    earned: loadEarned,
    catalog: () => CATALOG,
    rank() { return rankFor(loadEarned().length); },
    /* record an action: 'bid' {amount, clutch}, 'watch', 'win', 'maxbid', 'signin' */
    record(event, data = {}) {
      const s = loadStats();
      if (event === "bid") {
        s.bids += 1;
        s.biggestBid = Math.max(s.biggestBid, Number(data.amount || 0));
        if (data.clutch) s.clutch += 1;
      } else if (event === "watch") { s.watches += 1; }
      else if (event === "win") { s.wins += 1; }
      else if (event === "maxbid") { s.maxBids += 1; }
      else if (event === "signin") { s.signedIn = true; }
      saveStats(s);
      return evaluate(true);
    },
    refresh() { return evaluate(true); },
    render(container) {
      if (!container) return;
      const earned = loadEarned();
      const total = CATALOG.length;
      const pct = Math.round((earned.length / total) * 100);
      container.innerHTML = `
        <div class="badge-panel">
          <div class="badge-head">
            <h3>🏅 Your progress</h3>
            <span class="badge-rank">${rankFor(earned.length)}</span>
          </div>
          <div class="badge-progress">
            <div class="badge-bar"><span style="width:${pct}%"></span></div>
            <div class="badge-progress-label">${earned.length} of ${total} badges earned — keep bidding to rank up</div>
          </div>
          <div class="badge-grid">
            ${CATALOG.map((b) => `
              <div class="badge ${earned.includes(b.id) ? "earned" : ""}" data-tip="${b.name}: ${b.tip}">
                <span class="badge-ic">${b.ic}</span>
                <span class="badge-name">${b.name}</span>
              </div>`).join("")}
          </div>
        </div>`;
    },
  };

  window.DealzBadges = Badges;
})();
