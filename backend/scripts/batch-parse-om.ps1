param(
  [int]$Limit = 0,
  [switch]$Resume,
  [switch]$DryRun
)

$ArchiveRoot = "C:\Users\Leon\OneDrive - Myers Apartment Group\Deals\Archive"
$Endpoint = "https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/archive"
$Secret = "jedire-archive-2026"
$StateFile = "$PSScriptRoot\OM_BATCH_STATE.json"

Add-Type -AssemblyName System.Web

$state = @{}
if ($Resume -and (Test-Path $StateFile)) {
  $state = Get-Content $StateFile -Raw | ConvertFrom-Json -AsHashtable
  Write-Host "Resuming from $StateFile ($($state.Count) done)"
}

$omFiles = @()
$folders = Get-ChildItem $ArchiveRoot -Directory | Where-Object { $_.Name -notlike '_*' -and $_.Name -notlike '.*' } | Sort-Object Name

foreach ($folder in $folders) {
  $pdfs = Get-ChildItem $folder.FullName -Filter "*.pdf" -File
  $omPdf = $pdfs | Where-Object { $_.Name -match 'Offering Memorandum| OM |\.OM\b' } | Select-Object -First 1
  if (-not $omPdf) { $omPdf = $pdfs | Select-Object -First 1 }
  if ($omPdf) {
    $omFiles += , @{ ParcelId = $folder.Name; Path = $omPdf.FullName; Name = $omPdf.Name; SizeMB = [math]::Round($omPdf.Length / 1MB, 1) }
  }
}

Write-Host "Found $($omFiles.Count) OM PDFs in $($folders.Count) folders"

if ($Limit -gt 0) { $omFiles = $omFiles | Select-Object -First $Limit }

$total = $omFiles.Count
$procCount = 0
$success = 0
$failed = 0

foreach ($om in $omFiles) {
  $procCount++
  $parcelId = $om.ParcelId
  $percent = [math]::Round($procCount / $total * 100, 1)

  if ($Resume -and $state.ContainsKey($parcelId) -and $state[$parcelId].done) {
    Write-Host "[$procCount/$total $percent%] $parcelId -- SKIP (done)"
    continue
  }

  $msg = "[$procCount/$total $percent%] $parcelId -- $($om.Name) ($($om.SizeMB)MB)"
  Write-Host $msg -NoNewline

  if ($DryRun) { Write-Host " [DRY RUN]"; continue }

  $encodedPid = [System.Web.HttpUtility]::UrlEncode($parcelId)

  # Step 1: Send to parse-om
  $parseUrl = "$Endpoint/parse-om?parcel_id=$encodedPid"
  try {
    $result = curl.exe -s $parseUrl -H "x-ingest-secret: $Secret" -F "file=@$($om.Path)" --max-time 180 2>&1
    $obj = $result | ConvertFrom-Json -ErrorAction SilentlyContinue
  } catch {
    Write-Host " FAIL parse-om: $($_.Exception.Message)"
    $state[$parcelId] = @{ done = $true; error = $_.Exception.Message }
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

    # Pull all extraction fields from property section
    $prop = if ($obj.extraction -and $obj.extraction.property) { $obj.extraction.property } else { $null }

    $stories      = if ($prop -and $prop.stories)      { $prop.stories }      else { $null }
    $buildings    = if ($prop -and $prop.buildings)    { $prop.buildings }    else { $null }
    $netRentSF    = if ($prop -and $prop.netRentableSF){ $prop.netRentableSF } else { $null }
    $yrRenovated  = if ($prop -and $prop.yearRenovated){ $prop.yearRenovated } else { $null }
    $county       = if ($prop -and $prop.county)       { $prop.county }       else { $null }
    $parkSpaces   = if ($prop -and $prop.parkingSpaces){ $prop.parkingSpaces } else { $null }
    $parkRatio    = if ($prop -and $prop.parkingRatio) { $prop.parkingRatio }  else { $null }
    $amenities    = if ($prop -and $prop.amenities)    { $prop.amenities }     else { @() }
    $propType     = if ($prop -and $prop.propertyType) { $prop.propertyType }  else { $null }
    $assetClass   = if ($prop -and $prop.assetClass)   { $prop.assetClass }    else { $null }
    $constType    = if ($prop -and $prop.constructionType) { $prop.constructionType } else { $null }
    $parkType     = if ($prop -and $prop.parkingType)  { $prop.parkingType }   else { $null }

    # Investment thesis → narrative
    $narrative    = if ($obj.extraction -and $obj.extraction.investmentThesis) { $obj.extraction.investmentThesis } else { $null }

    if ($addr -and $city) {
      Write-Host " OK $addr, $city, $stateCode | yb=$yb units=$uc class=$assetClass" -NoNewline

      # Step 2: POST to update-pd to write all extracted fields to property_descriptions
      $body = @{
        parcel_id = $parcelId
        address = $addr
        city = $city
        state = $stateCode
        zip = $zip
      }
      if ($yb)           { $body.year_built      = [int]$yb }
      if ($uc)           { $body.unit_count       = [int]$uc }
      if ($stories)      { $body.stories          = [int]$stories }
      if ($buildings)    { $body.building_count   = [int]$buildings }
      if ($netRentSF)    { $body.rentable_sqft    = [int]$netRentSF }
      if ($yrRenovated)  { $body.year_renovated   = [int]$yrRenovated }
      if ($county)       { $body.county           = [string]$county }
      if ($parkSpaces)   { $body.parking_spaces   = [int]$parkSpaces }
      if ($parkRatio)    { $body.parking_ratio    = [double]$parkRatio }
      if ($propType)     { $body.property_type    = [string]$propType }
      if ($assetClass)   { $body.asset_class      = [string]$assetClass }
      if ($constType)    { $body.construction_type = [string]$constType }
      if ($parkType)     { $body.parking_type     = [string]$parkType }
      if ($narrative)    { $body.narrative        = [string]$narrative }
      if ($amenities -and $amenities.Count -gt 0) {
        $body.amenities = $amenities
      }

      # Use native PowerShell HTTP (more reliable than curl for JSON POST)
      try {
        $jsonBody = $body | ConvertTo-Json -Compress -Depth 5
        $null = Invoke-WebRequest -Uri "$Endpoint/update-pd" -Method Post -Headers @{ "x-ingest-secret" = $Secret } -Body $jsonBody -ContentType "application/json" -TimeoutSec 30 -UseBasicParsing
        Write-Host " [pd OK]"
      } catch {
        Write-Host " [pd FAIL: $($_.Exception.Message)]"
      }

      $state[$parcelId] = @{ done = $true; address = $addr; city = $city; state = $stateCode; zip = $zip; yearBuilt = $yb; units = $uc; stories = $stories; assetClass = $assetClass }
      $success++
    } else {
      Write-Host " OK (no address) | yb=$yb units=$uc class=$assetClass"

      # Still write non-address fields even when address is missing
      if ($yb -or $uc -or $assetClass -or $narrative -or ($amenities -and $amenities.Count -gt 0)) {
        $body = @{ parcel_id = $parcelId }
        if ($yb)         { $body.year_built      = [int]$yb }
        if ($uc)         { $body.unit_count       = [int]$uc }
        if ($assetClass) { $body.asset_class      = [string]$assetClass }
        if ($constType)  { $body.construction_type = [string]$constType }
        if ($parkType)   { $body.parking_type     = [string]$parkType }
        if ($propType)   { $body.property_type    = [string]$propType }
        if ($narrative)  { $body.narrative        = [string]$narrative }
        if ($amenities -and $amenities.Count -gt 0) { $body.amenities = $amenities }
        try {
          $jsonBody = $body | ConvertTo-Json -Compress -Depth 5
          $null = Invoke-WebRequest -Uri "$Endpoint/update-pd" -Method Post -Headers @{ "x-ingest-secret" = $Secret } -Body $jsonBody -ContentType "application/json" -TimeoutSec 30 -UseBasicParsing
          Write-Host " [pd OK (no-addr)]"
        } catch {
          Write-Host " [pd FAIL: $($_.Exception.Message)]"
        }
      }

      $state[$parcelId] = @{ done = $true; address = ""; yearBuilt = $yb; units = $uc; assetClass = $assetClass }
      $success++
    }
  } else {
    $errMsg = if ($obj.error) { $obj.error } else { "Unknown error" }
    Write-Host " FAIL $errMsg"
    $state[$parcelId] = @{ done = $true; error = $errMsg }
    $failed++
  }

  if ($procCount % 5 -eq 0 -or $procCount -eq $total) {
    $state | ConvertTo-Json -Depth 3 | Set-Content $StateFile
    Write-Host "State saved ($($state.Count) entries)"
  }

  Start-Sleep -Milliseconds 500
}

Write-Host "`n=== COMPLETE ==="
Write-Host "Processed: $procCount"
Write-Host "Success: $success"
Write-Host "Failed: $failed"
$state | ConvertTo-Json -Depth 3 | Set-Content $StateFile
Write-Host "Final state saved to $StateFile"
