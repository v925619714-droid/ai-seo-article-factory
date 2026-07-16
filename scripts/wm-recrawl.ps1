# Otpravka URL na pereobhod v Yandex Webmaster (posle deploya). ASCII-only, PS 5.1 safe.
# Publichnaya versiya: token i user_id — cherez peremennye okruzheniya.
#   $env:YANDEX_WEBMASTER_TOKEN — OAuth-token (scope webmaster:hostinfo + webmaster:verify)
#   $env:YANDEX_WEBMASTER_USER  — user_id (GET https://api.webmaster.yandex.net/v4/user)
# Usage: .\wm-recrawl.ps1 -Site https://example.ru -Urls @('/kurs','/stati')
#        .\wm-recrawl.ps1 -Site https://example.ru -FromFile spisok.txt   (po odnomu URL-path na stroku)
param(
  [Parameter(Mandatory = $true)][string]$Site,
  [string[]]$Urls = @(),
  [string]$FromFile = ''
)
$ErrorActionPreference = 'Stop'
$tok = $env:YANDEX_WEBMASTER_TOKEN
if (-not $tok) { throw 'Set $env:YANDEX_WEBMASTER_TOKEN' }
$hdr = @{ Authorization = "OAuth $tok"; 'Content-Type' = 'application/json' }
$uid = $env:YANDEX_WEBMASTER_USER
if (-not $uid) {
  $uid = (Invoke-RestMethod -Uri 'https://api.webmaster.yandex.net/v4/user' -Headers $hdr -TimeoutSec 30).user_id
}
$u2 = [Uri]$Site
$hostId = $u2.Scheme + ':' + $u2.Host + ':' + $(if ($u2.IsDefaultPort) { if ($u2.Scheme -eq 'https') { 443 } else { 80 } } else { $u2.Port })
if ($FromFile) { $Urls += Get-Content $FromFile | Where-Object { $_.Trim() } }
$ok = 0; $fail = 0
foreach ($u in $Urls) {
  $u = $u.Trim(); if (-not $u.StartsWith('/')) { $u = '/' + $u }
  $body = '{"url":"' + $Site.TrimEnd('/') + $u + '"}'
  try {
    $r = Invoke-RestMethod -Method Post -Uri "https://api.webmaster.yandex.net/v4/user/$uid/hosts/$hostId/recrawl/queue" -Headers $hdr -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 30
    Write-Output ("OK   " + $u + " task=" + $r.task_id)
    $ok++
  } catch {
    $msg = $_.Exception.Message
    try { $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream()); $msg = $sr.ReadToEnd() } catch {}
    Write-Output ("FAIL " + $u + " " + $msg.Substring(0, [Math]::Min(160, $msg.Length)))
    $fail++
  }
  Start-Sleep -Milliseconds 400
}
# ostatok kvoty (150/den na sayt — berech)
try {
  $q = Invoke-RestMethod -Uri "https://api.webmaster.yandex.net/v4/user/$uid/hosts/$hostId/recrawl/quota" -Headers $hdr -TimeoutSec 30
  Write-Output ("QUOTA remain=" + $q.quota_remainder + " daily=" + $q.daily_quota)
} catch {}
Write-Output ("DONE ok=$ok fail=$fail")
