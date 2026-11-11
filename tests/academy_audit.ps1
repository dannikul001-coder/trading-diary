param([int]$Width=390)
$ErrorActionPreference='Stop'
$browser=@('C:\Program Files\Google\Chrome\Application\chrome.exe','C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe') | Where-Object {Test-Path $_} | Select-Object -First 1
if(-not $browser){throw 'Chrome or Edge is required.'}
$fixture=(Resolve-Path (Join-Path $PSScriptRoot 'academy-models.html')).Path -replace '\\','/'
$profile=Join-Path $env:TEMP ('trading-diary-academy-audit-'+[guid]::NewGuid().ToString('N'))
$previous=$ErrorActionPreference
$ErrorActionPreference='Continue'
try{
  $dump=& $browser --headless=new --disable-gpu --no-first-run --allow-file-access-from-files --user-data-dir=$profile "--window-size=$Width,900" --virtual-time-budget=5000 --dump-dom ('file:///'+$fixture+'?audit=1') 2>$null | Out-String
  $code=$LASTEXITCODE
}finally{
  $ErrorActionPreference=$previous
  if(Test-Path -LiteralPath $profile){$resolved=(Resolve-Path -LiteralPath $profile).Path;$tempRoot=[IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')+'\';if($resolved.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolved).StartsWith('trading-diary-academy-audit-')){Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction SilentlyContinue}}
}
if($code -ne 0){throw "Browser exited: $code"}
if($dump -notmatch 'data-audit-ready="true"'){$detail=if($dump -match 'data-audit-error="([^"]+)"'){[Net.WebUtility]::HtmlDecode($Matches[1])}else{'No result'};throw $detail}
if($dump -notmatch 'data-audit="([^"]+)"'){throw 'Missing result'}
$result=[Net.WebUtility]::HtmlDecode($Matches[1])|ConvertFrom-Json
if($result.passed -ne 72){throw 'Not all lessons passed.'}
$result|ConvertTo-Json -Compress
