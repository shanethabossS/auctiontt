[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$wc = New-Object System.Net.WebClient
$urls = @(
    "http://142.93.14.0:3000/",
    "http://142.93.14.0:80/",
    "http://142.93.14.0:3000/postgrest")
foreach ($u in $urls) {
    try {
        $r = $wc.DownloadString($u)
        Write-Output ("DONE " + $u + " => " + $r)
    } catch {
        Write-Output ("ERR " + $u + " => " + $_.Exception.Message)
    }
}
