import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTabTheme } from "@/hooks/useTabTheme";
import { useTheme } from "@/contexts/ThemeContext";
import SubmarketsTab from "./tabs/SubmarketsTab";
import TrendsTab from "./tabs/TrendsTab";
import OwnersTab from "./tabs/OwnersTab";
import PropertyDataTab from "./tabs/PropertyDataTab";
import DealsTab from "./tabs/DealsTab";
import PowerRankingsTab from "./tabs/PowerRankingsTab";

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code',monospace" };
const sans: React.CSSProperties = { fontFamily: "'IBM Plex Sans',sans-serif" };

const T = {
  bg: "#0A0E17", panel: "#0F1319", panelAlt: "#131821", header: "#1A1F2E",
  hover: "#1E2538", active: "#252D40", topBar: "#050810",
  primary: "#E8ECF1", secondary: "#8B95A5", muted: "#4A5568",
  amber: "#F5A623", amberBright: "#FFD166", green: "#00D26A",
  red: "#FF4757", cyan: "#00BCD4", orange: "#FF8C42", purple: "#A78BFA",
  blue: "#3B82F6", blueBg: "#1e3a5f",
  borderS: "#1E2538", borderM: "#2A3348",
};

const MSA_RECORDS: Record<string, MSARecord> = {
  "atlanta-ga": {
    id: "atlanta-ga", name: "Atlanta, GA", full: "Atlanta-Sandy Springs-Roswell MSA",
    props: 1028, units: "250,412", jedi: 87, d30: "+4", confidence: 84,
    rent: "$2,150", rentD: "+4.2%", vac: "5.8%", absorb: "2,840/qtr",
    pipeline: "39,565", pipelinePct: "15.8%", moSupply: "14.1",
    pop: "6.2M", popD: "+2.1%", jobs: "3.1M", jobsD: "+2.8%",
    medInc: "$72,400", incD: "+3.4%", afford: "30.2%", jobsApt: "5.8x",
    cap: "5.2%", capD: "-20bps", ppu: "$218K", ppuD: "+8.4%", txnVol: "$4.2B", deals: "127",
    cycle: "EXPANSION", cycleMonth: 38, cyclePct: 65,
    rentHistory: [1820,1840,1860,1880,1920,1950,1980,2010,2050,2080,2120,2150],
    vacHistory: [6.8,6.6,6.4,6.2,6.0,5.9,5.8,5.7,5.6,5.6,5.7,5.8],
    rentSf: "$1.92", vsNational: "+12.4%", concession: "2.4%", revpau: "$1,986",
    permitVel: "-8.2% YoY",
    primer: `Atlanta is a <g>6.2M-person MSA</g> tracking <c>{props} properties</c> and <c>{units} units</c> across 8 submarkets. The market is in <g>month 38 of an expansion cycle</g> — employment growing <g>+2.8% YoY</g> (14th consecutive positive month), population <g>+2.1%</g> (3x national avg), and median household income <g>+3.4%</g>. Average effective rent reached <g>$2,150/mo (+4.2% YoY)</g> with vacancy tightening to <g>5.8%</g> — a 3-year low. <o>Primary risk:</o> supply pipeline is elevated at <o>15.8% of existing stock</o> (39,565 units), translating to <o>14.1 months of supply</o> at current absorption. However, absorption remains strong at <g>2,840 units/quarter</g> and permit velocity is decelerating — suggesting past-peak supply. <a>Affordability watch:</a> rent-to-income at 30.2%, approaching the 30% burdened threshold. Platform JEDI Score: <g>87 (+4 over 30d)</g> — Strong Opportunity.`,
    signals: [
      { id: "D", name: "DEMAND", score: 82, delta: "+3", weight: 30, color: T.green, desc: "Pop +2.1%, Employment +2.8%, Net migration +14K HH/yr. Amazon HQ expansion." },
      { id: "S", name: "SUPPLY", score: 64, delta: "-2", weight: 25, color: T.red, desc: "39,565 pipeline units (15.8% of stock). 14.1 mo supply. Past-peak permits." },
      { id: "M", name: "MOMENTUM", score: 78, delta: "+5", weight: 20, color: T.orange, desc: "Rent growth accelerating +4.2% YoY. Txn velocity +14%. Concessions falling." },
      { id: "P", name: "POSITION", score: 72, delta: "+1", weight: 15, color: T.purple, desc: "40th pctl nationally. Top quartile SE region. Institutional capital inflow." },
      { id: "R", name: "RISK", score: 28, delta: "-4", weight: 10, color: T.muted, desc: "Affordability 30.2% approaching threshold. Insurance +8% cap helps. Score inverted." },
    ],
    submarkets: [
      { name: "Midtown", jedi: 88, rent: "$2,056", rentD: "+4.8%", vac: "5.1%", pipe: "12.4%", opp: 82, cap: "4.8%", isTop: true },
      { name: "Buckhead", jedi: 84, rent: "$1,883", rentD: "+2.1%", vac: "6.2%", pipe: "8.8%", opp: 78, cap: "5.0%" },
      { name: "Sandy Springs", jedi: 81, rent: "$1,920", rentD: "+3.4%", vac: "5.8%", pipe: "10.2%", opp: 74, cap: "5.2%" },
      { name: "Decatur", jedi: 83, rent: "$1,890", rentD: "+3.8%", vac: "4.8%", pipe: "5.4%", opp: 84, cap: "5.0%" },
      { name: "West End", jedi: 79, rent: "$1,977", rentD: "+5.2%", vac: "6.8%", pipe: "6.2%", opp: 86, cap: "5.4%" },
      { name: "Downtown", jedi: 76, rent: "$1,542", rentD: "+2.8%", vac: "7.2%", pipe: "14.8%", opp: 68, cap: "5.6%" },
    ],
  },
  "raleigh-nc": {
    id: "raleigh-nc", name: "Raleigh, NC", full: "Raleigh-Durham-Cary MSA",
    props: 480, units: "98,200", jedi: 85, d30: "+3", confidence: 81,
    rent: "$1,740", rentD: "+3.9%", vac: "6.2%", absorb: "1,120/qtr",
    pipeline: "11,840", pipelinePct: "11.8%", moSupply: "10.6",
    pop: "1.4M", popD: "+2.8%", jobs: "720K", jobsD: "+3.1%",
    medInc: "$78,200", incD: "+4.2%", afford: "26.8%", jobsApt: "5.5x",
    cap: "5.0%", capD: "-15bps", ppu: "$204K", ppuD: "+9.1%", txnVol: "$1.8B", deals: "58",
    cycle: "EXPANSION", cycleMonth: 31, cyclePct: 55,
    rentHistory: [1540,1560,1580,1600,1620,1650,1670,1690,1705,1720,1730,1740],
    vacHistory: [7.2,7.0,6.8,6.6,6.5,6.4,6.3,6.2,6.2,6.1,6.2,6.2],
    rentSf: "$1.78", vsNational: "+4.8%", concession: "3.1%", revpau: "$1,632",
    permitVel: "-5.4% YoY",
    primer: `Raleigh is a <g>1.4M-person MSA</g> tracking <c>{props} properties</c> and <c>{units} units</c>. The Research Triangle market is in <g>month 31 of an expansion</g> — tech sector employment growing <g>+3.1% YoY</g>, population <g>+2.8%</g> (fastest in the Southeast). Average rent reached <g>$1,740/mo (+3.9% YoY)</g> with vacancy at <g>6.2%</g>. <o>Supply watch:</o> pipeline at <o>11.8% of stock</o> (11,840 units) with <o>10.6 months of supply</o>. Affordability is favorable at <g>26.8% rent-to-income</g>. JEDI Score: <g>85 (+3 over 30d)</g> — Strong Opportunity.`,
    signals: [
      { id: "D", name: "DEMAND", score: 86, delta: "+4", weight: 30, color: T.green, desc: "Pop +2.8%, Tech employment surging, Apple & Google campus expansion." },
      { id: "S", name: "SUPPLY", score: 68, delta: "-1", weight: 25, color: T.orange, desc: "11,840 pipeline units (11.8%). Past-peak construction permits." },
      { id: "M", name: "MOMENTUM", score: 80, delta: "+3", weight: 20, color: T.green, desc: "Rent growth +3.9% YoY. Transaction velocity rising. Low concessions." },
      { id: "P", name: "POSITION", score: 76, delta: "+2", weight: 15, color: T.purple, desc: "Top-5 SE market. Institutional capital targeting Research Triangle." },
      { id: "R", name: "RISK", score: 22, delta: "-2", weight: 10, color: T.muted, desc: "Affordability at 26.8% — healthy buffer. Low insurance risk." },
    ],
    submarkets: [
      { name: "Downtown Raleigh", jedi: 87, rent: "$1,820", rentD: "+4.6%", vac: "5.4%", pipe: "9.2%", opp: 84, cap: "4.8%", isTop: true },
      { name: "North Hills", jedi: 83, rent: "$1,760", rentD: "+3.8%", vac: "5.9%", pipe: "8.4%", opp: 79, cap: "5.1%" },
      { name: "Cary", jedi: 82, rent: "$1,710", rentD: "+3.2%", vac: "6.4%", pipe: "10.8%", opp: 75, cap: "5.2%" },
      { name: "Durham", jedi: 80, rent: "$1,640", rentD: "+4.1%", vac: "6.8%", pipe: "14.2%", opp: 72, cap: "5.4%" },
    ],
  },
  "charlotte-nc": {
    id: "charlotte-nc", name: "Charlotte, NC", full: "Charlotte-Concord-Gastonia MSA",
    props: 680, units: "142,000", jedi: 82, d30: "+3", confidence: 78,
    rent: "$1,680", rentD: "+3.5%", vac: "6.0%", absorb: "1,540/qtr",
    pipeline: "17,608", pipelinePct: "12.4%", moSupply: "11.4",
    pop: "2.7M", popD: "+2.2%", jobs: "1.4M", jobsD: "+2.6%",
    medInc: "$68,400", incD: "+3.1%", afford: "29.4%", jobsApt: "5.2x",
    cap: "5.2%", capD: "-10bps", ppu: "$196K", ppuD: "+7.2%", txnVol: "$2.4B", deals: "84",
    cycle: "EXPANSION", cycleMonth: 28, cyclePct: 50,
    rentHistory: [1480,1500,1520,1540,1560,1580,1600,1620,1640,1655,1668,1680],
    vacHistory: [7.0,6.8,6.6,6.4,6.3,6.2,6.1,6.0,6.0,5.9,6.0,6.0],
    rentSf: "$1.72", vsNational: "+1.8%", concession: "3.4%", revpau: "$1,579",
    permitVel: "-3.2% YoY",
    primer: `Charlotte is a <g>2.7M-person MSA</g> tracking <c>{props} properties</c> and <c>{units} units</c>. The financial hub is in <g>month 28 of expansion</g> with employment <g>+2.6% YoY</g> and population <g>+2.2%</g>. Rent reached <g>$1,680/mo (+3.5% YoY)</g> with vacancy at <g>6.0%</g>. <o>Supply:</o> 17,608 pipeline units (12.4% of stock). Affordability at 29.4% is approaching threshold. JEDI Score: <g>82 (+3 over 30d)</g> — Good Opportunity.`,
    signals: [
      { id: "D", name: "DEMAND", score: 80, delta: "+3", weight: 30, color: T.green, desc: "Banking sector expansion. Pop +2.2%. Corporate HQ relocations." },
      { id: "S", name: "SUPPLY", score: 66, delta: "-1", weight: 25, color: T.orange, desc: "17,608 pipeline units (12.4%). 11.4 months supply. Slowing permits." },
      { id: "M", name: "MOMENTUM", score: 74, delta: "+2", weight: 20, color: T.amber, desc: "Rent growth +3.5%. Steady absorption. Moderate velocity." },
      { id: "P", name: "POSITION", score: 70, delta: "+1", weight: 15, color: T.purple, desc: "Strong regional position. 3rd largest SE metro." },
      { id: "R", name: "RISK", score: 30, delta: "-2", weight: 10, color: T.muted, desc: "Affordability nearing 30% threshold. Score inverted." },
    ],
    submarkets: [
      { name: "South End", jedi: 86, rent: "$1,820", rentD: "+4.8%", vac: "5.2%", pipe: "9.4%", opp: 84, cap: "4.9%", isTop: true },
      { name: "Uptown", jedi: 82, rent: "$1,750", rentD: "+3.6%", vac: "5.8%", pipe: "11.2%", opp: 78, cap: "5.1%" },
      { name: "Ballantyne", jedi: 80, rent: "$1,640", rentD: "+3.1%", vac: "6.4%", pipe: "10.8%", opp: 72, cap: "5.4%" },
    ],
  },
  "tampa-fl": {
    id: "tampa-fl", name: "Tampa, FL", full: "Tampa-St. Petersburg-Clearwater MSA",
    props: 892, units: "215,000", jedi: 82, d30: "+2", confidence: 79,
    rent: "$1,908", rentD: "+3.0%", vac: "6.5%", absorb: "2,150/qtr",
    pipeline: "28,803", pipelinePct: "13.4%", moSupply: "13.4",
    pop: "3.2M", popD: "+1.9%", jobs: "1.6M", jobsD: "+2.4%",
    medInc: "$65,800", incD: "+2.8%", afford: "28.4%", jobsApt: "5.2x",
    cap: "5.4%", capD: "-12bps", ppu: "$208K", ppuD: "+6.8%", txnVol: "$3.1B", deals: "96",
    cycle: "LATE EXP", cycleMonth: 44, cyclePct: 72,
    rentHistory: [1680,1710,1730,1755,1780,1810,1840,1860,1875,1888,1898,1908],
    vacHistory: [7.4,7.2,7.0,6.9,6.8,6.6,6.5,6.4,6.4,6.5,6.5,6.5],
    rentSf: "$1.84", vsNational: "+15.2%", concession: "2.8%", revpau: "$1,786",
    permitVel: "-6.4% YoY",
    primer: `Tampa is a <g>3.2M-person MSA</g> tracking <c>{props} properties</c> and <c>{units} units</c>. The Bay Area market is in <g>month 44 of a late expansion cycle</g> — employment growing <g>+2.4% YoY</g>, population <g>+1.9%</g>, and median income <g>+2.8%</g>. Average effective rent reached <g>$1,908/mo (+3.0% YoY)</g> with vacancy at <g>6.5%</g>. <o>Primary risk:</o> supply pipeline at <o>13.4% of existing stock</o> (28,803 units) translating to <o>13.4 months of supply</o>. Amazon HQ expansion adding <g>2,000+ jobs</g>. Affordability at <g>28.4%</g> remains healthy. JEDI Score: <g>82 (+2 over 30d)</g> — Good Opportunity.`,
    signals: [
      { id: "D", name: "DEMAND", score: 80, delta: "+3", weight: 30, color: T.green, desc: "Amazon HQ expansion +2,000 jobs. Pop +1.9%. Strong in-migration from NE corridor." },
      { id: "S", name: "SUPPLY", score: 62, delta: "-1", weight: 25, color: T.orange, desc: "28,803 pipeline units (13.4%). 13.4 mo supply. Permits decelerating." },
      { id: "M", name: "MOMENTUM", score: 74, delta: "+2", weight: 20, color: T.amber, desc: "Rent growth +3.0% YoY. Absorption steady at 2,150/qtr. Concessions falling." },
      { id: "P", name: "POSITION", score: 68, delta: "+1", weight: 15, color: T.purple, desc: "Top 10 SE market. Strong tourist economy and port activity driving demand." },
      { id: "R", name: "RISK", score: 34, delta: "-2", weight: 10, color: T.muted, desc: "FL wind/flood insurance surcharges +12%. Affordability buffer healthy at 28.4%. Score inverted." },
    ],
    submarkets: [
      { name: "Ybor City", jedi: 86, rent: "$2,040", rentD: "+4.2%", vac: "5.4%", pipe: "9.8%", opp: 84, cap: "5.0%", isTop: true },
      { name: "Downtown Tampa", jedi: 82, rent: "$1,960", rentD: "+3.6%", vac: "6.0%", pipe: "12.4%", opp: 78, cap: "5.2%" },
      { name: "South Tampa", jedi: 80, rent: "$1,840", rentD: "+2.8%", vac: "6.8%", pipe: "11.2%", opp: 74, cap: "5.4%" },
      { name: "Westshore", jedi: 78, rent: "$1,760", rentD: "+2.4%", vac: "7.2%", pipe: "14.8%", opp: 70, cap: "5.6%" },
    ],
  },
  "orlando-fl": {
    id: "orlando-fl", name: "Orlando, FL", full: "Orlando-Kissimmee-Sanford MSA",
    props: 714, units: "178,000", jedi: 78, d30: "+1", confidence: 74,
    rent: "$1,820", rentD: "+2.4%", vac: "7.1%", absorb: "1,680/qtr",
    pipeline: "28,836", pipelinePct: "16.2%", moSupply: "17.2",
    pop: "2.8M", popD: "+1.7%", jobs: "1.3M", jobsD: "+2.1%",
    medInc: "$62,400", incD: "+2.4%", afford: "30.0%", jobsApt: "4.9x",
    cap: "5.6%", capD: "-8bps", ppu: "$194K", ppuD: "+5.2%", txnVol: "$2.2B", deals: "72",
    cycle: "PEAK", cycleMonth: 52, cyclePct: 82,
    rentHistory: [1600,1620,1645,1660,1680,1700,1720,1748,1768,1790,1808,1820],
    vacHistory: [7.8,7.6,7.5,7.4,7.3,7.2,7.1,7.0,7.0,7.1,7.1,7.1],
    rentSf: "$1.76", vsNational: "+9.8%", concession: "3.2%", revpau: "$1,706",
    permitVel: "-4.2% YoY",
    primer: `Orlando is a <g>2.8M-person MSA</g> tracking <c>{props} properties</c> and <c>{units} units</c>. The tourism-driven market is in <g>month 52 near cycle peak</g> — employment growing <g>+2.1% YoY</g>, population <g>+1.7%</g>. Average rent reached <g>$1,820/mo (+2.4% YoY)</g> with vacancy at <g>7.1%</g>. <o>Primary risk:</o> pipeline elevated at <o>16.2% of existing stock</o> (28,836 units) — <o>17.2 months of supply</o>. Tourism recovery continues with hotel-to-apartment conversions adding stock. <a>Affordability watch:</a> rent-to-income at 30.0%, at the burdened threshold. JEDI Score: <a>78 (+1 over 30d)</a> — Moderate Opportunity, cycle caution.`,
    signals: [
      { id: "D", name: "DEMAND", score: 74, delta: "+1", weight: 30, color: T.amber, desc: "Tourism recovery strong. Disney/Universal expansions. Remote worker influx slowing." },
      { id: "S", name: "SUPPLY", score: 48, delta: "-3", weight: 25, color: T.red, desc: "28,836 pipeline units (16.2%). 17.2 mo supply — elevated risk." },
      { id: "M", name: "MOMENTUM", score: 72, delta: "+1", weight: 20, color: T.amber, desc: "Rent growth +2.4% — decelerating. Absorption holding at 1,680/qtr." },
      { id: "P", name: "POSITION", score: 66, delta: "+1", weight: 15, color: T.purple, desc: "Mid-tier SE market. I-4 corridor advantages. Institutional interest moderate." },
      { id: "R", name: "RISK", score: 38, delta: "-1", weight: 10, color: T.muted, desc: "Affordability at 30% threshold. FL insurance risk. Score inverted." },
    ],
    submarkets: [
      { name: "Lake Nona", jedi: 84, rent: "$2,020", rentD: "+4.0%", vac: "5.8%", pipe: "11.2%", opp: 82, cap: "5.0%", isTop: true },
      { name: "Dr. Phillips", jedi: 80, rent: "$1,920", rentD: "+3.2%", vac: "6.4%", pipe: "9.8%", opp: 76, cap: "5.2%" },
      { name: "Winter Park", jedi: 76, rent: "$1,780", rentD: "+2.4%", vac: "7.2%", pipe: "14.2%", opp: 70, cap: "5.6%" },
      { name: "Downtown Orlando", jedi: 72, rent: "$1,640", rentD: "+1.8%", vac: "8.4%", pipe: "18.4%", opp: 64, cap: "5.8%" },
    ],
  },
  "miami-fl": {
    id: "miami-fl", name: "Miami, FL", full: "Miami-Fort Lauderdale-Pompano Beach MSA",
    props: 1245, units: "310,000", jedi: 74, d30: "-2", confidence: 71,
    rent: "$2,480", rentD: "+1.2%", vac: "8.4%", absorb: "1,920/qtr",
    pipeline: "57,660", pipelinePct: "18.6%", moSupply: "30.0",
    pop: "6.1M", popD: "+0.8%", jobs: "2.8M", jobsD: "+1.6%",
    medInc: "$58,900", incD: "+1.8%", afford: "50.5%", jobsApt: "4.4x",
    cap: "4.8%", capD: "+5bps", ppu: "$342K", ppuD: "+3.2%", txnVol: "$6.8B", deals: "184",
    cycle: "PEAK", cycleMonth: 58, cyclePct: 88,
    rentHistory: [2180,2220,2260,2300,2340,2370,2400,2420,2440,2455,2468,2480],
    vacHistory: [7.2,7.4,7.6,7.8,8.0,8.1,8.2,8.3,8.4,8.4,8.4,8.4],
    rentSf: "$2.38", vsNational: "+49.5%", concession: "4.2%", revpau: "$2,268",
    permitVel: "+2.1% YoY",
    primer: `Miami is a <g>6.1M-person MSA</g> tracking <c>{props} properties</c> and <c>{units} units</c>. The global gateway market is at <a>cycle peak (month 58)</a> — employment growing <g>+1.6% YoY</g>, population <g>+0.8%</g>. Average rent reached <g>$2,480/mo (+1.2% YoY)</g> but growth is decelerating with vacancy rising to <o>8.4%</o>. <o>Primary risk:</o> pipeline is critically elevated at <o>18.6% of existing stock</o> (57,660 units) with <o>30.0 months of supply</o> at current absorption. <a>Affordability crisis:</a> rent-to-income at <o>50.5%</o> — severely burdened, limiting organic demand growth. International capital inflow remains a demand driver but domestic renter pool is constrained. JEDI Score: <a>74 (-2 over 30d)</a> — Caution. Supply overhang headwind.`,
    signals: [
      { id: "D", name: "DEMAND", score: 68, delta: "-2", weight: 30, color: T.amber, desc: "International migration sustaining demand. Domestic renter pool constrained by affordability." },
      { id: "S", name: "SUPPLY", score: 38, delta: "-4", weight: 25, color: T.red, desc: "57,660 pipeline units (18.6%). 30.0 mo supply — extreme overhang." },
      { id: "M", name: "MOMENTUM", score: 62, delta: "-3", weight: 20, color: T.orange, desc: "Rent growth decelerating to +1.2%. Concessions rising +4.2%. Leasing velocity slowing." },
      { id: "P", name: "POSITION", score: 72, delta: "-1", weight: 15, color: T.purple, desc: "Global gateway. International capital. Lifestyle destination premium sustained." },
      { id: "R", name: "RISK", score: 48, delta: "+2", weight: 10, color: T.red, desc: "Affordability 50.5% — severely burdened. FL insurance surcharges. Hurricane risk. Score inverted." },
    ],
    submarkets: [
      { name: "Brickell", jedi: 80, rent: "$2,840", rentD: "+2.4%", vac: "7.2%", pipe: "14.8%", opp: 76, cap: "4.4%", isTop: true },
      { name: "Wynwood", jedi: 76, rent: "$2,560", rentD: "+1.8%", vac: "8.0%", pipe: "16.2%", opp: 72, cap: "4.6%" },
      { name: "Coral Gables", jedi: 74, rent: "$2,380", rentD: "+0.8%", vac: "8.8%", pipe: "12.4%", opp: 68, cap: "4.8%" },
      { name: "North Miami", jedi: 68, rent: "$2,120", rentD: "+0.4%", vac: "10.2%", pipe: "22.4%", opp: 60, cap: "5.2%" },
    ],
  },
  "jacksonville-fl": {
    id: "jacksonville-fl", name: "Jacksonville, FL", full: "Jacksonville-St. Johns-Clay MSA",
    props: 386, units: "82,000", jedi: 80, d30: "+5", confidence: 76,
    rent: "$1,580", rentD: "+3.8%", vac: "5.4%", absorb: "980/qtr",
    pipeline: "7,544", pipelinePct: "9.2%", moSupply: "7.7",
    pop: "1.6M", popD: "+2.4%", jobs: "760K", jobsD: "+2.8%",
    medInc: "$64,200", incD: "+3.2%", afford: "27.2%", jobsApt: "5.1x",
    cap: "5.8%", capD: "-18bps", ppu: "$178K", ppuD: "+9.8%", txnVol: "$1.2B", deals: "44",
    cycle: "EXPANSION", cycleMonth: 24, cyclePct: 42,
    rentHistory: [1380,1400,1420,1440,1460,1485,1510,1535,1552,1564,1574,1580],
    vacHistory: [6.8,6.5,6.2,6.0,5.8,5.6,5.5,5.4,5.4,5.4,5.4,5.4],
    rentSf: "$1.52", vsNational: "-4.6%", concession: "1.8%", revpau: "$1,484",
    permitVel: "-9.2% YoY",
    primer: `Jacksonville is a <g>1.6M-person MSA</g> tracking <c>{props} properties</c> and <c>{units} units</c>. Florida's largest city by land area is in <g>month 24 of an early expansion cycle</g> — the best momentum profile in the SE. Employment growing <g>+2.8% YoY</g>, population <g>+2.4%</g>, median income <g>+3.2%</g>. Average rent reached <g>$1,580/mo (+3.8% YoY)</g> with vacancy tightening to <g>5.4%</g> — a 5-year low. <g>Strongest supply discipline</g> in the peer set: pipeline only <g>9.2% of stock</g> (7,544 units) with <g>7.7 months of supply</g> — well below market equilibrium. Affordability is healthy at <g>27.2% rent-to-income</g>. JEDI Score: <g>80 (+5 over 30d) — best 30d momentum in cohort</g>. Emerging opportunity.`,
    signals: [
      { id: "D", name: "DEMAND", score: 82, delta: "+5", weight: 30, color: T.green, desc: "Nocatee #2 top-selling MPC nationally. Port expansion +1,400 jobs. Military demand stable." },
      { id: "S", name: "SUPPLY", score: 78, delta: "+2", weight: 25, color: T.green, desc: "7,544 pipeline units (9.2%) — lowest in peer set. 7.7 mo supply. Permits falling -9.2%." },
      { id: "M", name: "MOMENTUM", score: 80, delta: "+5", weight: 20, color: T.green, desc: "Rent growth accelerating +3.8%. Vacancy at 5-year low. Leasing velocity surging." },
      { id: "P", name: "POSITION", score: 70, delta: "+3", weight: 15, color: T.purple, desc: "Undervalued relative to peer MSAs. Institutional discovery phase. Rising cap compression." },
      { id: "R", name: "RISK", score: 20, delta: "-2", weight: 10, color: T.muted, desc: "Affordability 27.2% — healthy buffer. Low insurance risk vs Miami/Tampa. Score inverted." },
    ],
    submarkets: [
      { name: "Nocatee", jedi: 88, rent: "$1,840", rentD: "+5.2%", vac: "4.2%", pipe: "6.4%", opp: 88, cap: "5.4%", isTop: true },
      { name: "Southside", jedi: 82, rent: "$1,620", rentD: "+4.1%", vac: "5.0%", pipe: "7.8%", opp: 80, cap: "5.7%" },
      { name: "Riverside", jedi: 78, rent: "$1,540", rentD: "+3.6%", vac: "5.8%", pipe: "10.4%", opp: 74, cap: "5.9%" },
      { name: "Downtown JAX", jedi: 72, rent: "$1,440", rentD: "+2.8%", vac: "7.2%", pipe: "12.8%", opp: 66, cap: "6.2%" },
    ],
  },
};

type Signal = { id: string; name: string; score: number; delta: string; weight: number; color: string; desc: string };
type Submarket = { name: string; jedi: number; rent: string; rentD: string; vac: string; pipe: string; opp: number; cap: string; isTop?: boolean };
type MSARecord = {
  id: string; name: string; full: string; props: number; units: string;
  jedi: number; d30: string; confidence: number;
  rent: string; rentD: string; vac: string; absorb: string;
  pipeline: string; pipelinePct: string; moSupply: string;
  pop: string; popD: string; jobs: string; jobsD: string;
  medInc: string; incD: string; afford: string; jobsApt: string;
  cap: string; capD: string; ppu: string; ppuD: string; txnVol: string; deals: string;
  cycle: string; cycleMonth: number; cyclePct: number;
  rentHistory: number[]; vacHistory: number[];
  rentSf: string; vsNational: string; concession: string; revpau: string; permitVel: string;
  primer: string;
  signals: Signal[];
  submarkets: Submarket[];
};

type TabId = "overview" | "submarkets" | "trends" | "properties" | "deals" | "rankings" | "corphealth" | "owners";

const BASE_TABS: { id: TabId; label: string; code: string }[] = [
  { id: "overview",    label: "OVERVIEW",    code: "F4-1" },
  { id: "submarkets",  label: "SUBMARKETS",  code: "F4-2" },
  { id: "trends",      label: "TRENDS",      code: "F4-3" },
  { id: "properties",  label: "PROPERTIES",  code: "F4-4" },
  { id: "deals",       label: "DEALS",       code: "F4-5" },
  { id: "rankings",    label: "RANKINGS",    code: "F4-6" },
];
const CORP_HEALTH_TAB = { id: "corphealth" as TabId, label: "CORP HEALTH", code: "F4-7" };
const OWNERS_TAB      = { id: "owners"    as TabId, label: "OWNERS",      code: "F4-8" };

export interface CorpHealthSubmarket {
  name: string; msa: string | null; schi: number; divergence: number;
  signal: string; reHealth: number; hhi: number; employerCount: number; publicCount: number;
}
export interface CorpHealthData {
  schi: number; reHealth: number; divergence: number; herfindahl: number;
  portfolioSubmarkets: CorpHealthSubmarket[];
  topEmployerText: string;
}

function CorpHealthTab({ d }: { d: CorpHealthData }) {
  const { schi, reHealth: reH, divergence: div, herfindahl: hhi, portfolioSubmarkets, topEmployerText } = d;
  const sigColor = (s: string) => s === "bullish_divergence" ? T.green : s === "bearish_divergence" ? T.red : T.amber;
  const metric = (label: string, value: string, sub: string, color: string) => (
    <div style={{ flex: 1, background: T.panel, border: `1px solid ${T.borderS}`, padding: "8px 10px" }}>
      <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, marginBottom: 3, ...mono }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, ...mono, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: T.secondary, marginTop: 3, ...mono }}>{sub}</div>
    </div>
  );
  return (
    <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, ...mono }}>CORPORATE HEALTH INTELLIGENCE · SCHI · DIVERGENCE SCANNER · EMPLOYER RISK</div>
      <div style={{ display: "flex", gap: 6 }}>
        {metric("SCHI SCORE", schi.toFixed(1), "Submarket Corporate Health", schi >= 60 ? T.green : schi >= 40 ? T.amber : T.red)}
        {metric("RE HEALTH", reH.toFixed(1), "Real Estate Fundamentals", T.cyan)}
        {metric("DIVERGENCE", (div > 0 ? "+" : "") + div.toFixed(1), Math.abs(div) > 15 ? (div > 0 ? "BULLISH DIVERGENCE" : "BEARISH DIVERGENCE") : "ALIGNED", Math.abs(div) > 15 ? (div > 0 ? T.green : T.red) : T.amber)}
        {metric("HERFINDAHL", hhi.toFixed(3), hhi < 0.1 ? "Low concentration" : "High concentration", hhi < 0.1 ? T.green : T.red)}
      </div>
      <div style={{ padding: "6px 10px", background: (Math.abs(div) > 15 ? T.red : T.green) + "08", borderLeft: `3px solid ${Math.abs(div) > 15 ? T.amber : T.green}` }}>
        <span style={{ fontSize: 10, color: T.secondary }}>
          Corporate health is <span style={{ fontWeight: 700, color: schi >= 60 ? T.green : T.red }}>{schi >= 60 ? "STABLE" : "AT RISK"}</span>.
          {" "}Divergence: <span style={{ fontWeight: 700, color: Math.abs(div) > 15 ? T.amber : T.green }}>{Math.abs(div) > 15 ? (div > 0 ? "BULLISH" : "BEARISH") : "ALIGNED"}</span>.
          {" "}{topEmployerText}
        </span>
      </div>
      <div>
        <div style={{ fontSize: 9, color: T.amber, letterSpacing: 1, marginBottom: 6, ...mono }}>DIVERGENCE SCANNER — ALL SUBMARKETS · Sorted by |divergence|</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.6fr 0.6fr 0.7fr 0.7fr 0.5fr 0.5fr", background: T.topBar, borderBottom: `1px solid ${T.borderM}` }}>
          {["SUBMARKET","MSA","SCHI","RE HLTH","DIVERG","SIGNAL","HHI","EMP"].map(h => (
            <div key={h} style={{ padding: "4px 6px", fontSize: 7, fontWeight: 700, color: T.muted, letterSpacing: 0.7, borderRight: `1px solid ${T.borderS}`, ...mono }}>{h}</div>
          ))}
        </div>
        {[...portfolioSubmarkets].sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence)).map((s, i) => {
          const sc = sigColor(s.signal);
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.6fr 0.6fr 0.7fr 0.7fr 0.5fr 0.5fr", background: i % 2 === 0 ? T.panel : T.panelAlt, borderBottom: `1px solid ${T.borderS}` }}>
              <div style={{ padding: "5px 6px", fontSize: 10, fontWeight: 600, color: T.primary, borderRight: `1px solid ${T.borderS}`, ...mono }}>{s.name}</div>
              <div style={{ padding: "5px 6px", fontSize: 9, color: T.secondary, borderRight: `1px solid ${T.borderS}`, ...mono }}>{s.msa || "—"}</div>
              <div style={{ padding: "5px 6px", fontSize: 10, fontWeight: 700, color: s.schi >= 60 ? T.green : s.schi >= 40 ? T.amber : T.red, borderRight: `1px solid ${T.borderS}`, ...mono }}>{s.schi.toFixed(1)}</div>
              <div style={{ padding: "5px 6px", fontSize: 10, fontWeight: 700, color: T.cyan, borderRight: `1px solid ${T.borderS}`, ...mono }}>{s.reHealth.toFixed(1)}</div>
              <div style={{ padding: "5px 6px", fontSize: 10, fontWeight: 700, color: sc, borderRight: `1px solid ${T.borderS}`, ...mono }}>{(s.divergence > 0 ? "+" : "") + s.divergence.toFixed(1)}</div>
              <div style={{ padding: "5px 6px", fontSize: 9, fontWeight: 700, color: sc, borderRight: `1px solid ${T.borderS}`, ...mono }}>{s.signal === "bullish_divergence" ? "BULL" : s.signal === "bearish_divergence" ? "BEAR" : "ALIGN"}</div>
              <div style={{ padding: "5px 6px", fontSize: 9, color: s.hhi < 0.1 ? T.green : T.red, borderRight: `1px solid ${T.borderS}`, ...mono }}>{s.hhi.toFixed(3)}</div>
              <div style={{ padding: "5px 6px", fontSize: 9, color: T.secondary, ...mono }}>{s.employerCount}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreCell({ value, size = 11 }: { value: number; size?: number }) {
  const c = value >= 80 ? T.green : value >= 65 ? T.amber : T.red;
  return <span style={{ fontSize: size, fontWeight: 800, color: c, ...mono }}>{value}</span>;
}

function DeltaCell({ value }: { value: string }) {
  if (!value || value === "—") return <span style={{ color: T.muted, fontSize: 11 }}>—</span>;
  const positive = value.startsWith("+");
  const negative = value.startsWith("-");
  return <span style={{ fontSize: 11, fontWeight: 600, color: positive ? T.green : negative ? T.red : T.muted, ...mono }}>{value}</span>;
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ ...mono, fontSize: 11, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}33`, padding: "2px 7px", letterSpacing: 0.5 }}>{label}</span>;
}

function ThresholdVal({ value, thresholds, invert }: { value: string; thresholds: [number, number]; invert?: boolean }) {
  const n = parseFloat(value);
  let c: string;
  if (invert) c = n <= thresholds[0] ? T.green : n <= thresholds[1] ? T.amber : T.red;
  else c = n >= thresholds[0] ? T.green : n >= thresholds[1] ? T.amber : T.red;
  return <span style={{ fontSize: 12, fontWeight: 600, color: c, ...mono }}>{value}</span>;
}

function MiniChart({ data, color = T.green, h = 80 }: { data: number[]; color?: string; h?: number }) {
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${h - 8 - ((v - mn) / r) * (h - 16)}`).join(" ");
  const area = pts + ` 100,${h} 0,${h}`;
  return (
    <svg width="100%" height={h} style={{ display: "block" }} preserveAspectRatio="none" viewBox={`0 0 100 ${h}`}>
      <polygon points={area} fill={color + "12"} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.borderS}` }}>
      <span style={{ fontSize: 11, color: T.secondary, ...sans }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: color || T.primary, ...mono }}>{value}</span>
    </div>
  );
}

function PrimerText({ text, msa }: { text: string; msa: MSARecord }) {
  const resolved = text.replace("{props}", msa.props.toLocaleString()).replace("{units}", msa.units);
  const parts: React.ReactNode[] = [];
  const tagMap: Record<string, string> = { g: T.green, c: T.cyan, o: T.orange, a: T.amber };
  const tagRe = /<(g|c|o|a)>(.*?)<\/\1>/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  tagRe.lastIndex = 0;
  while ((match = tagRe.exec(resolved)) !== null) {
    if (match.index > lastIndex) parts.push(resolved.slice(lastIndex, match.index));
    parts.push(<span key={match.index} style={{ color: tagMap[match[1]], fontWeight: 600 }}>{match[2]}</span>);
    lastIndex = match.index + match[0].length;
  }
  parts.push(resolved.slice(lastIndex));
  return <p style={{ fontSize: 11, color: T.secondary, lineHeight: 1.7, margin: 0, ...sans }}>{parts}</p>;
}

function OverviewTab({ msa, cycleColor }: { msa: MSARecord; cycleColor: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {/* MARKET PRIMER */}
      <div style={{ background: T.panel, padding: "14px 18px" }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: T.amber, marginBottom: 8, ...mono }}>MARKET PRIMER · {msa.name.toUpperCase()}</div>
        <PrimerText text={msa.primer} msa={msa} />
      </div>

      {/* 3-COLUMN: Rent Chart | Supply-Demand | Economic Profile */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
        {/* Rent Chart */}
        <div style={{ background: T.panel, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, letterSpacing: 1, color: T.muted, ...mono }}>AVG RENT · 12MO</span>
            <div style={{ display: "flex", gap: 4 }}>
              {["1Y","3Y","5Y"].map((p, i) => (
                <span key={p} style={{ fontSize: 10, padding: "2px 6px", background: i === 0 ? T.amber : "transparent", color: i === 0 ? T.bg : T.muted, ...mono, cursor: "pointer" }}>{p}</span>
              ))}
            </div>
          </div>
          <MiniChart data={msa.rentHistory} color={T.green} h={90} />
          <div style={{ marginTop: 8, borderTop: `1px solid ${T.borderS}`, paddingTop: 6 }}>
            <MetricRow label="Current Avg Rent" value={msa.rent} />
            <MetricRow label="Rent Growth YoY" value={msa.rentD} color={T.green} />
            <MetricRow label="Avg Rent/SF" value={msa.rentSf} />
            <MetricRow label="vs National Avg" value={msa.vsNational} color={T.green} />
            <MetricRow label="Concession Rate" value={msa.concession} />
            <MetricRow label="RevPAU (Market)" value={msa.revpau} />
          </div>
        </div>

        {/* Supply-Demand */}
        <div style={{ background: T.panel, padding: 16 }}>
          <span style={{ fontSize: 11, letterSpacing: 1, color: T.cyan, ...mono }}>SUPPLY-DEMAND BALANCE</span>
          <div style={{ marginTop: 8 }}>
            <MetricRow label="Vacancy Rate" value={msa.vac} color={T.green} />
            <MetricRow label="Net Absorption" value={msa.absorb} />
            <MetricRow label="Pipeline Units" value={msa.pipeline} />
            <MetricRow label="Pipeline %" value={msa.pipelinePct} color={T.orange} />
            <MetricRow label="Months of Supply" value={msa.moSupply} color={T.orange} />
            <MetricRow label="Permit Velocity" value={msa.permitVel} color={T.green} />
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.borderM}` }}>
            <span style={{ fontSize: 11, letterSpacing: 1, color: T.amber, ...mono }}>TRANSACTION ACTIVITY</span>
            <div style={{ marginTop: 4 }}>
              <MetricRow label="Avg Cap Rate" value={msa.cap} />
              <MetricRow label="Cap Δ YoY" value={msa.capD} color={T.green} />
              <MetricRow label="Avg $/Unit" value={msa.ppu} />
              <MetricRow label="$/Unit Δ YoY" value={msa.ppuD} color={T.green} />
              <MetricRow label="Txn Volume (12mo)" value={msa.txnVol} />
              <MetricRow label="Deals Closed" value={msa.deals} />
            </div>
          </div>
        </div>

        {/* Economic Profile */}
        <div style={{ background: T.panel, padding: 16 }}>
          <span style={{ fontSize: 11, letterSpacing: 1, color: T.muted, ...mono }}>ECONOMIC PROFILE</span>
          <div style={{ marginTop: 8 }}>
            <MetricRow label="Population" value={msa.pop} />
            <MetricRow label="Pop Growth" value={msa.popD} color={T.green} />
            <MetricRow label="Employment" value={msa.jobs} />
            <MetricRow label="Job Growth" value={msa.jobsD} color={T.green} />
            <MetricRow label="Median HH Income" value={msa.medInc} />
            <MetricRow label="Income Growth" value={msa.incD} color={T.green} />
            <MetricRow label="Rent/Income Ratio" value={msa.afford} color={parseFloat(msa.afford) >= 30 ? T.orange : T.green} />
            <MetricRow label="Jobs/Apt Ratio" value={msa.jobsApt} />
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.borderM}` }}>
            <span style={{ fontSize: 11, letterSpacing: 1, color: T.purple, ...mono }}>CYCLE POSITION</span>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <Badge label={msa.cycle} color={cycleColor} />
              <span style={{ fontSize: 11, color: T.secondary, ...mono }}>Month {msa.cycleMonth}</span>
            </div>
            <div style={{ marginTop: 6, height: 6, background: T.bg, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${msa.cyclePct}%`, height: "100%", background: `linear-gradient(90deg, ${T.green}, ${T.amber})`, borderRadius: 3 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
              {["Trough", "Expansion", "Peak", "Contraction"].map(l => (
                <span key={l} style={{ fontSize: 9, color: T.muted, ...mono }}>{l}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* JEDI Score + Signals */}
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 1 }}>
        <div style={{ background: T.panel, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, ...mono }}>MARKET JEDI</div>
          <div style={{ width: 90, height: 90, borderRadius: "50%", border: `3px solid ${T.green}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", boxShadow: `0 0 16px ${T.green}33` }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: T.green }}>{msa.jedi}</span>
            <span style={{ fontSize: 10, color: T.green, fontWeight: 600, ...mono }}>{msa.d30} 30d</span>
          </div>
          <span style={{ fontSize: 10, color: T.muted, ...mono }}>Conf: {msa.confidence}%</span>
        </div>
        <div style={{ background: T.panel, padding: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: T.muted, marginBottom: 10, ...mono }}>JEDI SIGNAL BREAKDOWN</div>
          {msa.signals.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: T.muted, minWidth: 110, ...mono }}>{s.name} ({s.weight}%)</span>
              <div style={{ flex: "0 0 140px", height: 6, background: T.bg, borderRadius: 1 }}>
                <div style={{ height: "100%", width: `${s.score}%`, background: s.score >= 70 ? T.green : s.score >= 50 ? T.amber : T.red, borderRadius: 1 }} />
              </div>
              <ScoreCell value={s.score} size={12} />
              <DeltaCell value={s.delta} />
              <span style={{ fontSize: 11, color: T.muted, flex: 1, ...sans }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SUBMARKET PEER COMPARISON */}
      <div style={{ background: T.panel }}>
        <div style={{ padding: "8px 16px", borderBottom: `1px solid ${T.borderS}` }}>
          <span style={{ fontSize: 11, letterSpacing: 1, color: T.muted, ...mono }}>SUBMARKET PEER COMPARISON · {msa.name.toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", background: T.header, borderBottom: `1px solid ${T.borderM}` }}>
          {[{ l: "Submarket", w: 160 },{ l: "JEDI", w: 52 },{ l: "Rent", w: 76 },{ l: "Rent Δ", w: 64 },{ l: "Vac", w: 56 },{ l: "Pipe %", w: 64 },{ l: "Opp", w: 52 },{ l: "Cap", w: 52 }].map((c, i) => (
            <div key={i} style={{ width: c.w, minWidth: c.w, padding: "4px 8px", fontSize: 9, fontWeight: 700, color: T.muted, letterSpacing: 0.5, borderRight: `1px solid ${T.borderS}`, textTransform: "uppercase", ...mono }}>{c.l}</div>
          ))}
        </div>
        {msa.submarkets.map((s, i) => (
          <div key={i} style={{ display: "flex", background: s.isTop ? T.amber + "0A" : i % 2 === 0 ? T.panel : T.panelAlt, borderBottom: `1px solid ${T.borderS}`, borderLeft: s.isTop ? `2px solid ${T.amber}` : "2px solid transparent", cursor: "pointer" }}
            onMouseEnter={e => { if (!s.isTop) (e.currentTarget as HTMLDivElement).style.background = T.hover; }}
            onMouseLeave={e => { if (!s.isTop) (e.currentTarget as HTMLDivElement).style.background = i % 2 === 0 ? T.panel : T.panelAlt; }}>
            <div style={{ width: 160, minWidth: 160, padding: "5px 8px", borderRight: `1px solid ${T.borderS}` }}>
              <span style={{ fontSize: 11, fontWeight: s.isTop ? 700 : 500, color: s.isTop ? T.amberBright : T.primary, ...sans }}>{s.name}</span>
            </div>
            <div style={{ width: 52, minWidth: 52, padding: "5px 8px", borderRight: `1px solid ${T.borderS}` }}><ScoreCell value={s.jedi} size={13} /></div>
            <div style={{ width: 76, minWidth: 76, padding: "5px 8px", borderRight: `1px solid ${T.borderS}` }}><span style={{ fontSize: 12, fontWeight: 600, color: T.primary, ...mono }}>{s.rent}</span></div>
            <div style={{ width: 64, minWidth: 64, padding: "5px 8px", borderRight: `1px solid ${T.borderS}` }}><DeltaCell value={s.rentD} /></div>
            <div style={{ width: 56, minWidth: 56, padding: "5px 8px", borderRight: `1px solid ${T.borderS}` }}><ThresholdVal value={s.vac} thresholds={[5, 8]} invert /></div>
            <div style={{ width: 64, minWidth: 64, padding: "5px 8px", borderRight: `1px solid ${T.borderS}` }}><ThresholdVal value={s.pipe} thresholds={[8, 12]} invert /></div>
            <div style={{ width: 52, minWidth: 52, padding: "5px 8px", borderRight: `1px solid ${T.borderS}` }}><ScoreCell value={s.opp} size={12} /></div>
            <div style={{ width: 52, minWidth: 52, padding: "5px 8px" }}><span style={{ fontSize: 11, color: T.secondary, ...mono }}>{s.cap}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BloombergMarketDetailProps {
  embedded?: boolean;
  marketId?: string;
  corpHealthData?: CorpHealthData;
}

export default function BloombergMarketDetail({ embedded = false, marketId: marketIdProp, corpHealthData }: BloombergMarketDetailProps = {}) {
  const baseT = useTabTheme();
  const { isDark } = useTheme();
  const T = {
    ...baseT,
    panelAlt:   isDark ? "#131821" : "#F8FAFC",
    header:     isDark ? "#1A1F2E" : "#E2E8F0",
    hover:      isDark ? "#1E2538" : "#E2E8F0",
    active:     isDark ? "#252D40" : "#CBD5E1",
    primary:    baseT.text,
    amberBright:isDark ? "#FFD166" : "#F59E0B",
    orange:     isDark ? "#FF8C42" : "#EA580C",
    purple:     baseT.violet,
    blue:       isDark ? "#3B82F6" : "#2563EB",
    blueBg:     isDark ? "#1e3a5f" : "#DBEAFE",
    borderS:    isDark ? "#1E2538" : "#E2E8F0",
    borderM:    isDark ? "#2A3348" : "#CBD5E1",
  };
  const params = useParams<{ marketId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const resolvedId = marketIdProp || params.marketId || "atlanta-ga";
  const msa = MSA_RECORDS[resolvedId] || MSA_RECORDS["atlanta-ga"];
  const cycleColor = msa.cycle === "EXPANSION" ? T.green : msa.cycle === "LATE EXP" ? T.amber : T.orange;

  const effectiveTabs = (embedded && corpHealthData)
    ? [...BASE_TABS, CORP_HEALTH_TAB, OWNERS_TAB]
    : [...BASE_TABS, OWNERS_TAB];

  // When the marketId prop changes (MSA selector in terminal), reset to overview tab
  React.useEffect(() => { setActiveTab("overview"); }, [resolvedId]);

  return (
    <div style={{ background: T.bg, display: "flex", flexDirection: "column", color: T.primary, ...mono, ...(embedded ? { flex: 1, overflow: "hidden" } : { minHeight: "100vh" }) }}>
      {!embedded && (
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
          * { scrollbar-width: thin; scrollbar-color: ${T.borderM} ${T.bg}; box-sizing: border-box; }
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: ${T.bg}; }
          ::-webkit-scrollbar-thumb { background: ${T.borderM}; border-radius: 3px; }
        `}</style>
      )}

      {/* TOP BAR — standalone only */}
      {!embedded && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 32, padding: "0 16px", background: T.topBar, borderBottom: `1px solid ${T.borderS}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: T.amber, letterSpacing: 2 }}>JEDI RE</span>
            <span style={{ fontSize: 10, color: T.muted }}>|</span>
            <span style={{ fontSize: 10, color: T.secondary }}>F4 MARKETS · {BASE_TABS.find(t => t.id === activeTab)?.label}</span>
          </div>
        </div>
      )}

      {/* BREADCRUMB BAR — standalone only */}
      {!embedded && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px", height: 34, background: T.header, borderBottom: `1px solid ${T.borderM}`, flexShrink: 0 }}>
          <button
            onClick={() => navigate("/market-intelligence")}
            style={{ background: "transparent", border: `1px solid ${T.borderS}`, color: T.secondary, padding: "3px 10px", fontSize: 11, cursor: "pointer", ...mono, borderRadius: 2 }}
          >
            ◀ MSA INDEX
          </button>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.amber }}>{msa.name}</span>
          <span style={{ color: T.borderM }}>/</span>
          <span style={{ fontSize: 11, color: T.muted }}>{BASE_TABS.find(t => t.id === activeTab)?.label}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: T.muted }}>{msa.props.toLocaleString()} properties · {msa.units} units</span>
        </div>
      )}

      {/* QUOTE BAR — always visible */}
      <div style={{ padding: embedded ? "4px 12px" : "6px 16px", background: T.blueBg, borderBottom: `1px solid ${T.borderM}`, display: "flex", alignItems: "center", gap: embedded ? 10 : 14, flexShrink: 0 }}>
        {!embedded && <span style={{ fontSize: 17, fontWeight: 800, color: T.amberBright, ...sans }}>{msa.name}</span>}
        <span style={{ fontSize: embedded ? 10 : 12, color: T.secondary, ...sans }}>{msa.full}</span>
        <span style={{ fontSize: 10, color: T.muted }}>|</span>
        <span style={{ fontSize: embedded ? 11 : 13, fontWeight: 700, color: T.green, ...mono }}>{msa.rent}</span>
        <DeltaCell value={msa.rentD} />
        <span style={{ fontSize: 10, color: T.muted }}>|</span>
        <span style={{ fontSize: 10, color: T.muted, ...mono }}>Vac</span>
        <ThresholdVal value={msa.vac} thresholds={[5, 8]} invert />
        <span style={{ fontSize: 10, color: T.muted }}>|</span>
        <span style={{ fontSize: 10, color: T.muted, ...mono }}>JEDI</span>
        <ScoreCell value={msa.jedi} size={embedded ? 12 : 15} />
        <DeltaCell value={msa.d30} />
        <div style={{ flex: 1 }} />
        <Badge label={msa.cycle} color={cycleColor} />
        <span style={{ fontSize: 10, color: T.muted }}>Mo {msa.cycleMonth}</span>
        {embedded && <span style={{ fontSize: 10, color: T.muted }}>· {msa.props.toLocaleString()} props</span>}
      </div>

      {/* TAB BAR */}
      <div style={{ display: "flex", alignItems: "stretch", background: T.topBar, borderBottom: `1px solid ${T.borderM}`, flexShrink: 0, height: 30, overflowX: "auto" }}>
        {effectiveTabs.map(tab => {
          const isActive = activeTab === tab.id;
          const isCorpHealth = tab.id === "corphealth";
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: isActive ? T.panel : "transparent",
                color: isActive ? (isCorpHealth ? T.orange : T.amber) : T.secondary,
                border: "none",
                borderRight: `1px solid ${T.borderS}`,
                borderBottom: isActive ? `2px solid ${isCorpHealth ? T.orange : T.amber}` : "2px solid transparent",
                padding: "0 14px",
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                letterSpacing: 1,
                whiteSpace: "nowrap",
                ...mono,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      <div style={{ flex: 1, overflowY: "auto", background: T.bg }}>
        {activeTab === "overview" && <OverviewTab msa={msa} cycleColor={cycleColor} />}
        {activeTab === "submarkets" && <div style={{ background: T.bg, minHeight: "100%" }}><SubmarketsTab marketId={resolvedId} /></div>}
        {activeTab === "trends" && <div style={{ background: T.bg, minHeight: "100%" }}><TrendsTab marketId={resolvedId} /></div>}
        {activeTab === "properties" && <div style={{ background: T.bg, minHeight: "100%" }}><PropertyDataTab marketId={resolvedId} /></div>}
        {activeTab === "deals" && <div style={{ background: T.bg, minHeight: "100%" }}><DealsTab marketId={resolvedId} /></div>}
        {activeTab === "rankings" && <div style={{ background: T.bg, minHeight: "100%" }}><PowerRankingsTab marketId={resolvedId} /></div>}
        {activeTab === "corphealth" && corpHealthData && <CorpHealthTab d={corpHealthData} />}
        {activeTab === "owners" && <div style={{ background: T.bg, minHeight: "100%" }}><OwnersTab marketId={resolvedId} /></div>}
      </div>

      {/* FOOTER — standalone only */}
      {!embedded && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 16px", background: T.topBar, borderTop: `1px solid ${T.borderS}`, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: T.muted, ...mono }}>Sources: Apartment Locator AI · Census ACS · BLS QCEW · County Permits</span>
          <span style={{ fontSize: 10, color: T.muted, ...mono }}>{msa.name} · JEDI {msa.jedi} · MSA Level</span>
        </div>
      )}
    </div>
  );
}
