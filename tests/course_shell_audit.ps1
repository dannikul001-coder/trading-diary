$ErrorActionPreference = 'Stop'
$browser = @('C:\Program Files\Google\Chrome\Application\chrome.exe','C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Chrome or Edge is required for the course shell audit.' }
$fixture = (Resolve-Path (Join-Path $PSScriptRoot 'course-shell-preview.html')).Path -replace '\\','/'
$profile = Join-Path $env:TEMP ('trading-diary-course-shell-' + [guid]::NewGuid().ToString('N'))
$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  $dump = & $browser --headless=new --disable-gpu --no-first-run --allow-file-access-from-files --user-data-dir=$profile --window-size=390,844 --virtual-time-budget=2000 --dump-dom ('file:///' + $fixture) 2>$null | Out-String
  $browserExitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousErrorAction
  if (Test-Path -LiteralPath $profile) {
    $resolvedProfile = (Resolve-Path -LiteralPath $profile).Path
    $tempRoot = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
    if ($resolvedProfile.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolvedProfile).StartsWith('trading-diary-course-shell-')) { Remove-Item -LiteralPath $resolvedProfile -Recurse -Force -ErrorAction SilentlyContinue }
  }
}
if ($browserExitCode -ne 0) { throw "Headless browser exited with code $browserExitCode." }
if ($dump -notmatch 'data-audit-ready="true"') {
  $detail = if ($dump -match 'data-audit-error="([^"]+)"') { [Net.WebUtility]::HtmlDecode($Matches[1]) } else { 'no browser error was captured' }
  throw "Course shell fixture did not finish: $detail"
}
if ($dump -notmatch 'data-audit="([^"]+)"') { throw 'Course shell audit result is missing.' }
$result = ([Net.WebUtility]::HtmlDecode($Matches[1]) | ConvertFrom-Json)
if ($result.modules -ne 9) { throw 'The course must expose nine sequential modules.' }
if ($result.lessons -lt 20) { throw 'The new course program is incomplete.' }
if ($result.available -ne 1) { throw 'Exactly one exemplar lesson should be available in the first local version.' }
if ($result.planned -ne ($result.lessons - 1)) { throw 'Planned lesson states are inconsistent.' }
if (-not $result.noVideo -or -not $result.hasNoVideoLabel) { throw 'The no-video format is not explicit.' }
if (-not $result.hasInteractiveFeature) { throw 'The exemplar interactive lesson is not featured.' }
if ($result.horizontalOverflow) { throw 'Course shell has horizontal overflow at 390px.' }
$result | ConvertTo-Json -Compress
