$ErrorActionPreference = 'Stop'

$browser = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Chrome or Edge is required for the interactive course audit.' }

$fixture = (Resolve-Path (Join-Path $PSScriptRoot 'interactive-course-preview.html')).Path -replace '\\','/'
$url = 'file:///' + $fixture
$profile = Join-Path $env:TEMP ('trading-diary-course-audit-' + [guid]::NewGuid().ToString('N'))
$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  $dump = & $browser --headless=new --disable-gpu --no-first-run --allow-file-access-from-files --user-data-dir=$profile --window-size=390,844 --virtual-time-budget=3000 --dump-dom $url 2>$null | Out-String
  $browserExitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousErrorAction
  if (Test-Path -LiteralPath $profile) {
    $resolvedProfile = (Resolve-Path -LiteralPath $profile).Path
    $tempRoot = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
    if ($resolvedProfile.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolvedProfile).StartsWith('trading-diary-course-audit-')) {
      Remove-Item -LiteralPath $resolvedProfile -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

if ($browserExitCode -ne 0) { throw "Headless browser exited with code $browserExitCode." }
if ($dump -notmatch 'data-audit-ready="true"') { throw 'Interactive course fixture did not finish.' }
if ($dump -notmatch 'data-audit="([^"]+)"') { throw 'Interactive course audit result is missing.' }
$result = ([Net.WebUtility]::HtmlDecode($Matches[1]) | ConvertFrom-Json)

if (-not $result.lessonRendered) { throw 'Interactive lesson did not render.' }
if ($result.scenarios -ne 3) { throw 'Expected three simulated scenarios.' }
if (-not $result.noVideo) { throw 'Video or iframe is present in the no-video lesson.' }
if (-not $result.simulatedLabel) { throw 'Simulation disclosure is missing.' }
if (-not $result.scenarioAdvanced) { throw 'Scenario did not reveal its next step.' }
if (-not $result.futureHidden) { throw 'Blind practice exposes future candles before the answer.' }
if (-not $result.futureRevealed) { throw 'Blind practice did not reveal future candles after the answer.' }
if (-not $result.practiceFeedback) { throw 'Practice feedback is missing.' }
if (-not $result.quizScore) { throw 'Knowledge check did not reach 100% with correct answers.' }
if (-not $result.completionEnabled) { throw 'Lesson completion was not enabled after practice and quiz.' }
if (-not $result.completed) { throw 'Completion callback was not called.' }
if ($result.horizontalOverflow) { throw 'Global horizontal overflow detected at 390px.' }

$result | ConvertTo-Json -Compress
