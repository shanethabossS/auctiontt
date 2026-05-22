$ErrorActionPreference = 'Stop'

Write-Host 'Checking PostgREST root...'
$root = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:33001/
if ($root.StatusCode -ne 200) { throw 'PostgREST root failed' }

Write-Host 'Checking categories endpoint...'
$cats = Invoke-RestMethod "http://127.0.0.1:33001/auction_categories?select=id,slug,name"
if (-not $cats -or $cats.Count -lt 1) { throw 'No categories found' }

Write-Host 'Checking lot feed endpoint...'
$lots = Invoke-RestMethod "http://127.0.0.1:33001/v_lot_feed?select=id,title,current_bid,bid_count,ends_at&order=ends_at.asc&limit=1"
if (-not $lots -or $lots.Count -ne 1) { throw 'Lot feed query failed' }
$lotId = $lots[0].id
$nextBid = [decimal]$lots[0].current_bid + 100

Write-Host 'Placing a test bid via RPC...'
$body = @{ p_lot_id = $lotId; p_bidder_name = 'api-test'; p_amount = $nextBid } | ConvertTo-Json
$rpc = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:33001/rpc/place_bid" -ContentType 'application/json' -Body $body
if (-not $rpc.id) { throw 'RPC did not return lot row' }

Write-Host 'Creating watchlist entry...'
$uniqueEmail = "tester+$(Get-Random)@auctionsite.local"
$watchBody = @{ email = $uniqueEmail; lot_id = $lotId } | ConvertTo-Json
$watch = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:33001/watchlists" -Headers @{ Prefer = 'return=representation' } -ContentType 'application/json' -Body $watchBody
if (-not $watch[0].id) { throw 'Watchlist insert failed' }

Write-Host 'API tests passed.'
