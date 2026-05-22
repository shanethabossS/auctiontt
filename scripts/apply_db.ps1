param(
  [string]$SqlFile = "C:\AI_WORKSPACE\AUCTIONSITE\db\001_auctionsite_schema.sql",
  [string]$DbHost = "127.0.0.1",
  [int]$Port = 55432,
  [string]$DbName = "auctionsite",
  [string]$DbUser = "auction_admin",
  [string]$DbPassword = "auction_admin_pass"
)

if (!(Test-Path $SqlFile)) {
  throw "SQL file not found: $SqlFile"
}

$env:PGPASSWORD = $DbPassword
Get-Content -Raw $SqlFile | psql -v ON_ERROR_STOP=1 -h $DbHost -p $Port -U $DbUser -d $DbName
if ($LASTEXITCODE -ne 0) {
  throw "Failed to apply migration"
}

Write-Host "Applied migration: $SqlFile"
