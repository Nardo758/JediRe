param(
  [switch]$DryRun
)

$ArchiveRoot = "C:\Users\Leon\OneDrive - Myers Apartment Group\Deals\Archive"
$Endpoint = "https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/archive"
$Secret = "jedire-archive-2026"
$StateFile = "$PSScriptRoot\OM_BATCH_STATE.json"

Add-Type -AssemblyName System.Web

$state = Get-Content $StateFile -Raw | ConvertFrom-Json

# Find failed entries to retry
$retryList = $state.PSObject.Properties | Where-Object {
  $v = $_.Value
  $v.error -and $v.error -ne 'PDF appears to be empty or unparseable'
} | Sort-Object Name

Write-Host "Retrying $($retryList.Count) entries (skip unparseable PDFs)"

$total = $retryList.Count
$procCount = 0
$success = 0
$failed = 0

foreach ($entry in $retryList) {
  $parcelId = $entry.Name
  $procCount++
  $percent = [math]::Round($procCount / $total * 100, 1)

  # Find the folder and its PDF
  $folder = Join-Path $ArchiveRoot $parcelId
  if (-not (Test-Path $folder)) {
    Write-Host "[$procCount/$total $percent%] $parcelId -- folder not found!"
    continue
  }

  $pdfs = Get-ChildItem $folder -Filter "*.pdf" -File
  $omPdf = $pdfs | Where-Object { $_.Name -match 'Offering Memorandum| OM |\.OM\b' } | Select-Object -First 1
  if (-not $omPdf) { $omPdf = $pdfs | Select-Object -First 1 }
  if (-not $omPdf) {
    Write-Host "[$procCount/$total $percent%] $parcelId -- no PDF found"
    continue
  }

  $sizeMB = [math]::Round($omPdf.Length / 1MB, 1)
  Write-Host "[$procCount/$total $percent%] $parcelId -- $($omPdf.Name) ($($sizeMB)MB)" -NoNewline

  if ($DryRun) { Write-Host " [DRY RUN]"; continue }

  $encodedPid = [System.Web.HttpUtility]::UrlEncode($parcelId)

  # Step 1: parse-om
  $parseUrl = "$Endpoint/parse-om?parcel_id=$encodedPid"
  try {
    $result = curl.exe -s $parseUrl -H "x-ingest-secret: $Secret" -F "file=@$($omPdf.FullName)" --max-time 180 2>&1
    $obj = $result | ConvertFrom-Json -ErrorAction SilentlyContinue
  } catch {
    Write-Host " FAIL parse-om: $($_.Exception.Message)"
    $entry.Value.error = $_.Exception.Message
    $failed++
    continue
  }

  if ($obj.success) {
    $addr = if ($obj.address) { $obj.address } else { "" }
    $city = if ($obj.city) { $obj.city } else { "" }
    $stateCode = if ($obj.state) { $obj.state } else { "" }
    $zip = if ($obj.zip) { $obj.zip } else { "" }
    $yb = $obj.yearBuilt
    $uc = $obj.units
    $stories = if ($obj.extraction -and $obj.extraction.property -and $obj.extraction.property.stories) { $obj.extraction.property.stories } else { $null }

    if ($addr -and $city) {
      Write-Host " OK $addr, $city, $stateCode | yb=$yb units=$uc" -NoNewline

      $body = @{
        parcel_id = $parcelId
        address = $addr
        city = $city
        state = $stateCode
        zip = $zip
      }
      if ($yb) { $body.year_built = [int]$yb }
      if ($uc) { $body.unit_count = [int]$uc }
      if ($stories) { $body.stories = [int]$stories }

      try {
        $jsonBody = $body | ConvertTo-Json -Compress
        $null = Invoke-WebRequest -Uri "$Endpoint/update-pd" -Method Post -Headers @{ "x-ingest-secret" = $Secret } -Body $jsonBody -ContentType "application/json" -TimeoutSec 30 -UseBasicParsing
        Write-Host " [pd OK]"
        $entry.Value.done = $true
        $entry.Value.address = $addr
        $entry.Value.city = $city
        $entry.Value.state = $stateCode
        $entry.Value.zip = $zip
        $entry.Value.yearBuilt = $yb
        $entry.Value.units = $uc
        $entry.Value.stories = $stories
        $entry.Value.PSObject.Properties.Remove('error')
        $success++
      } catch {
        Write-Host " [pd FAIL: $($_.Exception.Message)]"
        $entry.Value.error = "update-pd: $($_.Exception.Message)"
        $failed++
      }
    } else {
      Write-Host " OK (no address) | yb=$yb units=$uc"
      $entry.Value.done = $true
      $entry.Value.address = ""
      $entry.Value.yearBuilt = $yb
      $entry.Value.units = $uc
      $entry.Value.PSObject.Properties.Remove('error')
      $success++
    }
  } else {
    $errMsg = if ($obj.error) { $obj.error } else { "Unknown error" }
    Write-Host " FAIL $errMsg"
    $entry.Value.error = $errMsg
    $failed++
  }

  if ($procCount % 5 -eq 0 -or $procCount -eq $total) {
    $state | ConvertTo-Json -Depth 3 | Set-Content $StateFile
    Write-Host "State saved"
  }

  Start-Sleep -Milliseconds 500
}

Write-Host "`n=== RETRY COMPLETE ==="
Write-Host "Processed: $procCount"
Write-Host "Success: $success"
Write-Host "Failed: $failed"
$state | ConvertTo-Json -Depth 3 | Set-Content $StateFile
Write-Host "Final state saved to $StateFile"
