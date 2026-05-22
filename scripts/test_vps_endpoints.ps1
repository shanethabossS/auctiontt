param([string]$Url, [string]$Label)
try {
    $r = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 8 -UseBasicParsing -SkipInvalidCertificateValidation -ErrorAction SilentlyContinue
    "$Label STATUS=$($r.StatusCode) BODY=$($r.Content.Substring(0, [Math]::Min(200, $r.Content.Length))"
} catch {
    $exc = $_.Exception
    "$Label ERROR=$($exc.Message.Substring(0, [Math]::Min(100, $exc.Message.Length))"
}
