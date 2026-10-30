// Founding-seller offer banner (static sites). Removes itself after 31 Dec 2026, Trinidad time.
(function () {
  if (Date.now() >= Date.parse('2027-01-01T04:00:00Z')) return;
  try { if (sessionStorage.getItem('sov_founding_banner_dismissed') === 'v1') return; } catch (e) { /* storage blocked */ }
  var bar = document.createElement('div');
  bar.setAttribute('role', 'status');
  bar.style.cssText = 'position:relative;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px 14px;padding:10px 44px 10px 14px;background:linear-gradient(100deg,#1e1b4b 0%,#115e59 100%);color:#f8fafc;border-bottom:2px solid #fbbf24;font:15px/1.35 Georgia,"Times New Roman",serif;text-align:center';
  bar.innerHTML = '<span style="background:#fbbf24;color:#1e1b4b;font:800 12px system-ui,sans-serif;letter-spacing:.08em;padding:3px 9px;border-radius:999px">FOUNDING SELLER OFFER</span><span>Your first ad: <strong style="color:#fde68a;font-size:18px">TT$50</strong> for 31 days, until 31 December. Every ad after: <strong style="color:#fde68a;font-size:18px">TT$100</strong>.</span><a href="/pricing.html" style="color:#fbbf24;font:800 15px system-ui,sans-serif;text-decoration:underline;white-space:nowrap">See all prices</a><button type="button" aria-label="Dismiss offer" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);width:24px;height:24px;border:1px solid rgba(255,255,255,.5);border-radius:999px;background:rgba(255,255,255,.12);color:#f8fafc;cursor:pointer">x</button>';
  bar.querySelector('button').onclick = function () { try { sessionStorage.setItem('sov_founding_banner_dismissed', 'v1'); } catch (e) { /* storage blocked */ } bar.remove(); };
  document.body.insertBefore(bar, document.body.firstChild);
})();
