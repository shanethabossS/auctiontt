[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$wc = New-Object System.Net.WebClient

$endpoints = @(
    "http://142.93.14.0:3000/time/now",
    "http://142.93.14.0:3000/upload-image",
    "http://142.93.14.0:3000/auth/login",
    "http://142.93.14.0:3000/postgrest/"
)

foreach ($url in $endpoints) {
    try {
        $content = $wc.DownloadString($url)
        Write-Output $url
        Write-Output ("OK: " + $content)
    } catch {
        Write-Output $url
        Write-Output ("ERROR: " + $_.Exception.Message)
    }
}
