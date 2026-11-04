$ErrorActionPreference = 'Stop'

$chromeCandidates = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
)
$browser = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Chrome or Edge is required for the browser audit.' }

$fixture = (Resolve-Path (Join-Path $PSScriptRoot 'browser-fixture.html')).Path -replace '\\','/'
$url = 'file:///' + $fixture
$profile = Join-Path $env:TEMP ('trading-diary-browser-audit-' + [guid]::NewGuid().ToString('N'))
$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  $dump = & $browser --headless=new --disable-gpu --no-first-run --allow-file-access-from-files --user-data-dir=$profile --window-size=390,844 --virtual-time-budget=2500 --dump-dom $url 2>$null | Out-String
  $browserExitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousErrorAction
  if (Test-Path -LiteralPath $profile) {
    $resolvedProfile = (Resolve-Path -LiteralPath $profile).Path
    $tempRoot = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
    if ($resolvedProfile.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and
        (Split-Path -Leaf $resolvedProfile).StartsWith('trading-diary-browser-audit-')) {
      Remove-Item -LiteralPath $resolvedProfile -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

if ($browserExitCode -ne 0) { throw "Headless browser exited with code $browserExitCode." }

if ($dump -notmatch 'data-audit-ready="true"') { throw 'Browser fixture did not finish.' }
if ($dump -notmatch 'data-audit="([^"]+)"') { throw 'Browser audit result is missing.' }
$json = [Net.WebUtility]::HtmlDecode($Matches[1])
$result = $json | ConvertFrom-Json

if (-not $result.dashboardRendered) { throw 'Dashboard did not render.' }
if ($result.chartPoints -lt 3) { throw 'Interactive capital history points are missing.' }
if ([string]::IsNullOrWhiteSpace($result.chartTooltip)) { throw 'Chart tooltip did not react to focus.' }
if ($result.analyticsValues.Count -lt 2) { throw 'Visible daily income values are missing.' }
$completedLabel = -join @(0x041F,0x0440,0x043E,0x0439,0x0434,0x0435,0x043D | ForEach-Object { [char]$_ })
if ($result.scheduleStatuses -notcontains $completedLabel) { throw 'Completed signal status is missing.' }
if ($result.bulkControls -lt 2) { throw 'Bulk schedule controls are missing.' }
if ($result.horizontalOverflow) { throw 'Global horizontal overflow detected at 390px.' }

$result | ConvertTo-Json -Compress
