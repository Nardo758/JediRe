/**
 * archive-property-catalog.ts — Scan all 296 archive folders and extract property metadata
 *
 * For each property, reads OM PDFs, rent rolls, T12s, BoxScores and extracts
 * address, built info, unit mix, and other core fields.
 * Outputs consolidated CSV: docs/operations/ARCHIVE_PROPERTY_CATALOG.csv
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/archive-property-catalog.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ARCHIVE_ROOT = 'C:\\Users\\Leon\\OneDrive - Myers Apartment Group\\Deals\\Archive';
const OUTPUT = path.join(__dirname, '..', '..', 'docs', 'operations', 'ARCHIVE_PROPERTY_CATALOG.csv');

interface PropertyRecord {
  ParcelId: string; Address: string; City: string; State: string; ZIP: string;
  County: string; MSA: string; Submarket: string;
  YearBuilt: string; YearRenovated: string; AssetClass: string;
  Stories: string; ConstructionType: string; PropertyType: string;
  UnitCount: string; AvgUnitSqft: string; NetRentableSqft: string;
  ParkingType: string; ParkingRatio: string; LotSizeAcres: string;
  ManagementCompany: string;
  Notes: string; DataConfidence: string; SourceFiles: string;
}

const COLS: (keyof PropertyRecord)[] = [
  'ParcelId','Address','City','State','ZIP','County','MSA','Submarket',
  'YearBuilt','YearRenovated','AssetClass','Stories','ConstructionType',
  'PropertyType','UnitCount','AvgUnitSqft','NetRentableSqft','ParkingType',
  'ParkingRatio','LotSizeAcres','ManagementCompany','Notes','DataConfidence','SourceFiles'
];

// ---- Known MSA/State from seeding ----
const KNOWN: Record<string,{msa:string;state:string;city:string}> = {
  "100 Inverness":                {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "1420 Magnolia":                {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "33 West":                      {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "45 Eighty Dunwoody":           {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Dunwoody"},
  "72 West":                      {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "7900 Park Central":            {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "860 South":                    {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Marietta"},
  "900 Dwell":                    {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Accent 2050":                  {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Addison on Long Beach":        {msa:"Los Angeles-Long Beach-Anaheim, CA",state:"CA",city:"Long Beach"},
  "Alta Dairies":                 {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Alta Midtown":                 {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Altis & Altra":                {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Arium Parkway":                {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Ascend Sandy":                 {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Sandy Springs"},
  "Ascen Varina":                 {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Ashley River":                 {msa:"Charleston-North Charleston, SC",state:"SC",city:"Charleston"},
  "Avril Cambridge":              {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Axiom":                        {msa:"Charlotte-Concord-Gastonia, NC-SC",state:"NC",city:"Charlotte"},
  "Axis Berewick":                {msa:"Charlotte-Concord-Gastonia, NC-SC",state:"NC",city:"Charlotte"},
  "Azola Palm Beach":             {msa:"Miami-Fort Lauderdale-West Palm Beach, FL",state:"FL",city:"West Palm Beach"},
  "Bainbridge Aviation Crossings":{msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Bainbridge Matthews":          {msa:"Charlotte-Concord-Gastonia, NC-SC",state:"NC",city:"Matthews"},
  "Bainbridge Research Park":     {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Bainbridge Sunlake":           {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Barcelona Apartments":         {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Bell Bishop arts":             {msa:"Dallas-Fort Worth-Arlington, TX",state:"TX",city:"Dallas"},
  "Bell Parkland":                {msa:"Dallas-Fort Worth-Arlington, TX",state:"TX",city:"Dallas"},
  "Bellevue Spring Creek":        {msa:"Dallas-Fort Worth-Arlington, TX",state:"TX",city:"Dallas"},
  "Biscayne 112":                 {msa:"Miami-Fort Lauderdale-West Palm Beach, FL",state:"FL",city:"Miami"},
  "Bridgeview Apartments":        {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Broadstone Highland Creek":    {msa:"Charlotte-Concord-Gastonia, NC-SC",state:"NC",city:"Charlotte"},
  "Broadstone Junction":          {msa:"Charlotte-Concord-Gastonia, NC-SC",state:"NC",city:"Charlotte"},
  "Broadstone Lemmond Farm":      {msa:"Charlotte-Concord-Gastonia, NC-SC",state:"NC",city:"Charlotte"},
  "Broadstone Station":           {msa:"Charlotte-Concord-Gastonia, NC-SC",state:"NC",city:"Charlotte"},
  "Broadstone Sugar Hill":        {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Sugar Hill"},
  "Broadstone Trailside":         {msa:"Charlotte-Concord-Gastonia, NC-SC",state:"NC",city:"Charlotte"},
  "Cadence Music Factory":        {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Cadence Sugar Hill":           {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Sugar Hill"},
  "Cadence at Nocatee":           {msa:"Jacksonville, FL",state:"FL",city:"Nocatee"},
  "Carrington at Brier Creek":    {msa:"Raleigh-Durham-Chapel Hill, NC",state:"NC",city:"Raleigh"},
  "Casa Mara":                    {msa:"Miami-Fort Lauderdale-West Palm Beach, FL",state:"FL",city:"Miami"},
  "CasaMara":                     {msa:"Miami-Fort Lauderdale-West Palm Beach, FL",state:"FL",city:"West Palm Beach"},
  "Chapel Hill":                  {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Charlotte Pike":               {msa:"Nashville-Davidson-Murfreesboro-Franklin, TN",state:"TN",city:"Nashville"},
  "Charlotte Two Pack":           {msa:"Charlotte-Concord-Gastonia, NC-SC",state:"NC",city:"Charlotte"},
  "Citadel Lookout":              {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Citizen House":                {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Citron Allen":                 {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Coddle Creek":                 {msa:"Charlotte-Concord-Gastonia, NC-SC",state:"NC",city:"Charlotte"},
  "Cornerstone":                  {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Cottages at emerald Creek":    {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Franklin Jones":               {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Gateway at Hartfield":         {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Harbor at Westshore":          {msa:"Tampa-St. Petersburg-Clearwater, FL",state:"FL",city:"Tampa"},
  "Hardy Oak":                    {msa:"San Antonio-New Braunfels, TX",state:"TX",city:"San Antonio"},
  "Hawthorne at Clairmont":       {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Heights at Sugarloaf":         {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Heron Pointe":                 {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Highlands at Preston":         {msa:"Dallas-Fort Worth-Arlington, TX",state:"TX",city:"Dallas"},
  "Highlnad Ridge Apartments":    {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Hoover Two Pack":              {msa:"Birmingham-Hoover, AL",state:"AL",city:"Hoover"},
  "Hunter Pointe":                {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Indigo Run":                   {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Infield Orlando":              {msa:"Orlando-Kissimmee-Sanford, FL",state:"FL",city:"Orlando"},
  "Jade at Hyde Park":            {msa:"Tampa-St. Petersburg-Clearwater, FL",state:"FL",city:"Tampa"},
  "Jade hyde Park":               {msa:"Tampa-St. Petersburg-Clearwater, FL",state:"FL",city:"Tampa"},
  "Jefferson Apartment Building": {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Jones Grant":                  {msa:"Charlotte-Concord-Gastonia, NC-SC",state:"NC",city:"Charlotte"},
  "Junction at Antiquity":        {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Kennesaw Deals":               {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Kennesaw"},
  "Kia Ora":                      {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Lake Ridge":                   {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Legacy Crossroads":            {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Leo Loso":                     {msa:"Dallas-Fort Worth-Arlington, TX",state:"TX",city:"Dallas"},
  "Linvingston":                  {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Linz Holy Springs":            {msa:"Raleigh-Durham-Chapel Hill, NC",state:"NC",city:"Raleigh"},
  "Livano Canyon Falls":          {msa:"San Antonio-New Braunfels, TX",state:"TX",city:"San Antonio"},
  "Livano Pflugerville":          {msa:"Austin-Round Rock, TX",state:"TX",city:"Pflugerville"},
  "Lofts at Weston":              {msa:"Miami-Fort Lauderdale-West Palm Beach, FL",state:"FL",city:"Weston"},
  "Lucent":                       {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "MAdison Farms":                {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Manor 6 forks":                {msa:"Raleigh-Durham-Chapel Hill, NC",state:"NC",city:"Raleigh"},
  "Matthews Reserve":             {msa:"Charlotte-Concord-Gastonia, NC-SC",state:"NC",city:"Matthews"},
  "Mercer Park":                  {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Mira Flores":                  {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Mirabella Lakes":              {msa:"Miami-Fort Lauderdale-West Palm Beach, FL",state:"FL",city:"Miami"},
  "Modena":                       {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Morningside":                  {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Novel Research Park":          {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Novel Upper Westside":         {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Oasis - Dania Pointe":         {msa:"Miami-Fort Lauderdale-West Palm Beach, FL",state:"FL",city:"Dania Beach"},
  "Paces Brook":                  {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Palmetto Pointe":              {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Parian Apartments":            {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Park 2300":                    {msa:"Dallas-Fort Worth-Arlington, TX",state:"TX",city:"Dallas"},
  "Park Ave":                     {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Park on Clairmont":            {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Parkview Greer":               {msa:"Greenville-Anderson-Mauldin, SC",state:"SC",city:"Greer"},
  "Patterson Place":              {msa:"Charlotte-Concord-Gastonia, NC-SC",state:"NC",city:"Charlotte"},
  "Pointe Grand Apartments":      {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Post Peachtree Hills":         {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Preserve at Branch Creek":     {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Preserve at Northpoint":       {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Pringle Square":               {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Providence on Main":           {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Providence Place":             {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Randle":                       {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Reserve at Sugarloaf":         {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Sage at Mill Creek":           {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Savannah Quarters":            {msa:"Savannah, GA",state:"GA",city:"Savannah"},
  "Sawgrass":                     {msa:"Miami-Fort Lauderdale-West Palm Beach, FL",state:"FL",city:"Coral Springs"},
  "SOB":                          {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Solis Interlock":              {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Solis Suwanaee":              {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Suwanee"},
  "Sophia":                       {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "South Highlands":              {msa:"Birmingham-Hoover, AL",state:"AL",city:"Birmingham"},
  "Sparkman Way":                 {msa:"Nashville-Davidson-Murfreesboro-Franklin, TN",state:"TN",city:"Nashville"},
  "St. Johns Heritage":           {msa:"Jacksonville, FL",state:"FL",city:"St. Johns"},
  "Stillwater":                   {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Stone Ridge":                  {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Stonehaven":                   {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Ten Oaks":                     {msa:"Nashville-Davidson-Murfreesboro-Franklin, TN",state:"TN",city:"Nashville"},
  "Terraces at Sugarloaf":        {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "The Alden":                    {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "The Archer":                   {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "The Darby":                    {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "The Devine":                   {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "The Dylan":                    {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "The Haven":                    {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "The Mason":                    {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "The Mason Sugarloaf":          {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Sugar Hill"},
  "The Mc Coy":                   {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "The Place at 1825":            {msa:"Austin-Round Rock, TX",state:"TX",city:"Pflugerville"},
  "The Residences at 3000 Bardin":{msa:"Dallas-Fort Worth-Arlington, TX",state:"TX",city:"Grand Prairie"},
  "Thrive Decatur":               {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Decatur"},
  "Thrive McDonough":             {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"McDonough"},
  "Tides":                        {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Tronco Lofts":                 {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Upton":                        {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Venue at North Point":         {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Vistas at Westside":           {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Vita Ravenswood":              {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Windward Lake":                {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Winston":                      {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Woodland Preserve":            {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
  "Woodland Reserve":             {msa:"Atlanta-Sandy Springs-Roswell, GA",state:"GA",city:"Atlanta"},
};

// Year built from OM extraction
const YB: Record<string,string> = {
  "Avril Cambridge":"2023","Solis Suwanaee":"2022","Novel Upper Westside":"2023",
  "Lucent":"2023","Solis Interlock":"2022","Bellevue Spring Creek":"2006",
  "Bell Parkland":"2007","Cadence at Nocatee":"2020","Heron Pointe":"2000",
  "Bell Bishop arts":"2022","The Mason Sugarloaf":"2021","Novel Research Park":"2022",
  "Leo Loso":"2021","Vita Ravenswood":"2017","Highlands at Preston":"2001",
  "Paces Brook":"1984","Broadstone Highland Creek":"2018","Mirabella Lakes":"2022",
  "The Devine":"2022","Broadstone Lemmond Farm":"2022","Parian Apartments":"1989",
  "Vistas at Westside":"2023","Broadstone Sugar Hill":"2004",
  "The Residences at 3000 Bardin":"2022","Alta Dairies":"2019",
  "Broadstone Trailside":"2015","Post Peachtree Hills":"1986","Park Ave":"2020",
  "Upton":"1999","Harbor at Westshore":"2002","Cornerstone":"1983",
  "Citadel Lookout":"2022","Sawgrass":"2022","Axiom":"2014","Biscayne 112":"2015",
  "Carrington at Brier Creek":"1999","Arium Parkway":"2022","MAdison Farms":"2022",
  "Addison on Long Beach":"2022"
};

// ---- Extraction ----

function readFileText(fp: string): string {
  try {
    const ext = path.extname(fp).toLowerCase();
    
    // For XLSX, try to extract text from zip entries
    if (ext === '.xlsx') {
      try {
        const { execSync } = require('child_process');
        // PowerShell can read OOXML as a zip
        const psScript = `
\$zip = [System.IO.Compression.ZipFile]::OpenRead('${fp.replace(/'/g, "''")}');
\$entries = \$zip.Entries | Where-Object { \$_.Name -like 'sharedStrings.xml' -or \$_.Name -like 'xl/sharedStrings.xml' };
if (\$entries) {
  \$entry = \$entries[0];
  \$reader = New-Object System.IO.StreamReader(\$entry.Open());
  \$xml = \$reader.ReadToEnd();
  \$reader.Close();
  # Extract text between <t>...</t> tags
  \$matches = [regex]::Matches(\$xml, '<t[^>]*>([^<]+)</t>');
  \$text = (\$matches | ForEach-Object { \$_.Groups[1].Value }) -join ' ';
  Write-Output \$text;
}
\$zip.Dispose();
`;
        const buf = execSync(`powershell -NoProfile -Command "${psScript.Replace('"','\"').Replace('\n',' ').Replace('\r','')}"`, { timeout: 10000, encoding: 'buffer', maxBuffer: 5*1024*1024 });
        const txt = buf.toString('utf8').trim();
        if (txt.length > 50) return txt.slice(0, 200000);
      } catch {}
    }
    
    const buf2 = fs.readFileSync(fp, { flag: 'r' });
    const BUF = 30000;
    const slice = buf2.length > BUF ? buf2.slice(0, BUF) : buf2;
    const str = slice.toString('utf8');
    const printable = str.replace(/[\x00-\x08\x0E-\x1F]/g, '').length;
    if (printable < str.length * 0.05) return '';
    return str.replace(/[\x00-\x08\x0E-\x1F]/g, ' ').replace(/\s+/g, ' ').slice(0, 50000);
  } catch { return ''; }
}

const PATTERNS: Record<string, RegExp[]> = {
  address: [/^\s*(\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}(?:\s+(?:Dr|Drive|St|Street|Rd|Road|Blvd|Boulevard|Ave|Avenue|Ln|Lane|Ct|Court|Cir|Circle|Way|Pkwy|Parkway)))\s*$/gm],
  stateZip: [/\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/g],
  yearBuilt: [/(?:Year\s+Built|Yr\s+Built|Constructed|Built|Year\s+of\s+Construction)[:\s]*(\d{4})\b/gi],
  yearRenovated: [/(?:Renovated|Renovation|Year\s+Renovated|Recent\s+Renovation)[:\s]*(\d{4})\b/gi],
  stories: [/(\d+)[-\s]*(?:story|stories|floor|floors)\b/gi],
  unitCount: [/(\d{2,4})\s*(?:unit|units|apartment(?:s)?|homes)\b/gi],
  assetClass: [/\b(Class\s*[ABCD])\b/gi],
  constructionType: [/\b(Wood\s*Frame|Concrete|Steel\s*Frame|Masonry|Mixed|Slab|Podium)\b/gi],
  propertyType: [/\b(Garden|Mid[-\s]?Rise|Mid\s+Rise|High[-\s]?Rise|High\s+Rise|Townhome|Townhouse|Walk[-\s]?Up)\b/gi],
  parkingType: [/(?:Parking[:\s]*|\b)(Surface|Garage|Covered|Mixed|Tuck[\s-]?Under)\s*(?:parking)?/gi],
  parkingRatio: [/(\d+\.?\d*)\s*(?:spaces|spots?)\s*(?:\/|per)\s*unit/gi],
  lotSize: [/(\d+\.?\d*)\s*(?:acres|acre)\b/gi],
  avgUnitSqft: [/(\d{3})\s*(?:sq\.?\s*ft|square\s*feet|SF)\s*(?:avg|average)?/gi],
  totalSqft: [/(\d{3,6})\s*(?:sq\.?\s*ft|square\s*feet|SF)\s*(?:building|total|rentable)?/gi],
  managementCo: [/(?:Managed\s+by|Management|Managed By)[:\s]*([A-Z][A-Za-z\s.&]+?)\s*(?:\d|$|[A-Z]{2}\b)/gi],
};

function extract(text: string, field: string): string[] {
  const res = new Set<string>();
  const pats = PATTERNS[field];
  if (!pats) return [];
  for (const p of pats) {
    p.lastIndex = 0;
    let m;
    while ((m = p.exec(text)) !== null) {
      if (m[1]) res.add(m[1].trim());
    }
  }
  return [...res];
}

// ---- Main ----

async function main() {
  const dirs = fs.readdirSync(ARCHIVE_ROOT)
    .filter(d => fs.statSync(path.join(ARCHIVE_ROOT, d)).isDirectory() && !d.startsWith('_') && !d.startsWith('.'))
    .sort();

  const records: PropertyRecord[] = [];

  for (const dir of dirs) {
    const dirPath = path.join(ARCHIVE_ROOT, dir);
    const files = fs.readdirSync(dirPath).filter(f => !f.startsWith('~$'));
    
    const sources: string[] = [];
    let combinedText = '';
    
    for (const file of files) {
      const fp = path.join(dirPath, file);
      if (fs.statSync(fp).isFile() && !file.endsWith('.docx') && !file.endsWith('.pptx') && !file.endsWith('.msg')) {
        const txt = readFileText(fp);
        if (txt.length > 100) {
          combinedText += '\n' + txt;
          sources.push(file);
        }
      }
    }

    const rec: PropertyRecord = {
      ParcelId: dir,
      Address: '',
      City: KNOWN[dir]?.city || '',
      State: KNOWN[dir]?.state || '',
      ZIP: '',
      County: '',
      MSA: KNOWN[dir]?.msa || '',
      Submarket: '',
      YearBuilt: YB[dir] || '',
      YearRenovated: '',
      AssetClass: '',
      Stories: '',
      ConstructionType: '',
      PropertyType: '',
      UnitCount: '',
      AvgUnitSqft: '',
      NetRentableSqft: '',
      ParkingType: '',
      ParkingRatio: '',
      LotSizeAcres: '',
      ManagementCompany: '',
      Notes: '',
      DataConfidence: 'none',
      SourceFiles: sources.slice(0, 5).join('; '),
    };

    // Extract fields from text
    const addresses = extract(combinedText, 'address');
    if (addresses.length > 0) rec.Address = addresses[0];
    
    const stateZip = extract(combinedText, 'stateZip');
    if (stateZip.length >= 1) rec.ZIP = stateZip[0];
    
    const ybs = extract(combinedText, 'yearBuilt');
    if (!rec.YearBuilt && ybs.length > 0) rec.YearBuilt = ybs[0];
    
    const yrs = extract(combinedText, 'yearRenovated');
    if (yrs.length > 0) rec.YearRenovated = yrs[yrs.length-1];
    
    const sts = extract(combinedText, 'stories');
    if (sts.length > 0) rec.Stories = sts[0];
    
    const ucs = extract(combinedText, 'unitCount');
    if (ucs.length > 0) rec.UnitCount = ucs[0];
    
    const cls = extract(combinedText, 'assetClass');
    if (cls.length > 0) rec.AssetClass = cls[0].replace('Class ','');
    
    const cts = extract(combinedText, 'constructionType');
    if (cts.length > 0) rec.ConstructionType = cts[0];
    
    const pts = extract(combinedText, 'propertyType');
    if (pts.length > 0) rec.PropertyType = pts[0];
    
    const pkts = extract(combinedText, 'parkingType');
    if (pkts.length > 0) rec.ParkingType = pkts[0];
    
    const pkrs = extract(combinedText, 'parkingRatio');
    if (pkrs.length > 0) rec.ParkingRatio = pkrs[0];
    
    const lots = extract(combinedText, 'lotSize');
    if (lots.length > 0) rec.LotSizeAcres = lots[0];
    
    const avgSqft = extract(combinedText, 'avgUnitSqft');
    if (avgSqft.length > 0) rec.AvgUnitSqft = avgSqft[0];
    
    const totSqft = extract(combinedText, 'totalSqft');
    if (totSqft.length > 0) rec.NetRentableSqft = totSqft[0];
    
    const mgmt = extract(combinedText, 'managementCo');
    if (mgmt.length > 0) rec.ManagementCompany = mgmt[0];

    // Compute confidence
    let filled = 0;
    const core: (keyof PropertyRecord)[] = ['City','State','MSA','YearBuilt','AssetClass','Stories','PropertyType','UnitCount'];
    for (const k of core) if (rec[k]) filled++;
    if (filled >= 6 && rec.YearBuilt) rec.DataConfidence = 'high';
    else if (filled >= 3) rec.DataConfidence = 'medium';
    else if (filled >= 1) rec.DataConfidence = 'low';
    else rec.DataConfidence = 'none';

    records.push(rec);
  }

  // Write CSV
  const lines: string[] = [COLS.join(',')];
  for (const rec of records) {
    const row = COLS.map(c => {
      const v = (rec[c] || '').replace(/"/g, '""');
      if (v.includes(',') || v.includes('"') || v.includes('\n')) return `"${v}"`;
      return v;
    });
    lines.push(row.join(','));
  }
  
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, '\ufeff' + lines.join('\r\n'), 'utf8');
  
  console.log(`Wrote ${records.length} rows to ${OUTPUT}`);
  
  // Summary stats
  const withYb = records.filter(r => r.YearBuilt).length;
  const withUnits = records.filter(r => r.UnitCount).length;
  const withClass = records.filter(r => r.AssetClass).length;
  const withStories = records.filter(r => r.Stories).length;
  const withType = records.filter(r => r.PropertyType).length;
  const withConstructor = records.filter(r => r.ConstructionType).length;
  const highConf = records.filter(r => r.DataConfidence === 'high').length;
  const medConf = records.filter(r => r.DataConfidence === 'medium').length;
  const lowConf = records.filter(r => r.DataConfidence === 'low').length;
  const noneConf = records.filter(r => r.DataConfidence === 'none').length;
  
  console.log(`\nCoverage:`);
  console.log(`  Year Built:     ${withYb}/${records.length}${withYb >= records.length ? ' ✅' : ''}`);
  console.log(`  Unit Count:     ${withUnits}/${records.length}`);
  console.log(`  Asset Class:    ${withClass}/${records.length}`);
  console.log(`  Stories:        ${withStories}/${records.length}`);
  console.log(`  Property Type:  ${withType}/${records.length}`);
  console.log(`  Construction:   ${withConstructor}/${records.length}`);
  console.log(`\nConfidence: ${highConf} high, ${medConf} medium, ${lowConf} low, ${noneConf} none`);
  console.log(`\nFields available for analysis: ${COLS.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
