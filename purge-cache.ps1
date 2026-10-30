# Purges raw.githack's cache of the MathVKBD files after a push to GitHub, so Moodle and the playground get the new
# versions at once, then checks each file against the local copy.
#
#   .\purge-cache.ps1                              all .js and .html files of this folder
#   .\purge-cache.ps1 mathQuestion.js mathCheck.js  only these
#
# The browser keeps its own copy too: reload the Moodle page / the playground with Ctrl+F5.
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Files)

$base = "https://raw.githack.com/AviNat/MathVKBD/main/"
if (-not $Files) {
    $Files = Get-ChildItem -Path $PSScriptRoot -File | Where-Object { $_.Extension -in ".js", ".html" } | ForEach-Object { $_.Name }
}

foreach ($f in $Files) {
    $url = $base + $f
    try {
        Invoke-WebRequest -Method Delete -Uri ("https://raw.githack.com/purge?url=" + [uri]::EscapeDataString($url)) -UseBasicParsing | Out-Null
    } catch {
        Write-Host ("{0,-28} purge failed: {1}" -f $f, $_.Exception.Message) -ForegroundColor Red
        continue
    }
    # the served file against the local one (line ends aside: GitHub may store LF)
    $status = "purged"
    $local = Join-Path $PSScriptRoot $f
    if (Test-Path $local) {
        try {
            $served = (Invoke-WebRequest -Uri $url -UseBasicParsing -Headers @{ "Cache-Control" = "no-cache" }).Content
            if ($served -is [byte[]]) { $served = [System.Text.Encoding]::UTF8.GetString($served) }
            $mine = [System.IO.File]::ReadAllText($local)
            if (($served -replace "`r`n", "`n").TrimStart([char]0xFEFF) -eq ($mine -replace "`r`n", "`n").TrimStart([char]0xFEFF)) {
                $status = "purged, same as the local file"
            } else {
                $status = "purged, but GitHub has a different version - not pushed yet?"
            }
        } catch {
            $status = "purged; not on GitHub ($($_.Exception.Message))"
        }
    }
    $color = "Green"
    if ($status -ne "purged, same as the local file") { $color = "Yellow" }
    Write-Host ("{0,-28} {1}" -f $f, $status) -ForegroundColor $color
}
