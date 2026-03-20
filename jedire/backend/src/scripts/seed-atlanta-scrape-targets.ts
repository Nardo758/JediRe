import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface SeedTarget {
  name: string;
  address: string;
  websiteUrl: string;
}

const ATLANTA_TARGETS: SeedTarget[] = [
  { name: 'Broadstone Pullman', address: '777 Memorial Dr SE, Atlanta, GA 30312', websiteUrl: 'https://www.broadstonepullman.com' },
  { name: 'Modera Vinings', address: '2770 Paces Ferry Rd SE, Atlanta, GA 30339', websiteUrl: 'https://www.moderavinings.com' },
  { name: 'The Residences at The Interlock', address: '1115 Howell Mill Rd NW, Atlanta, GA 30318', websiteUrl: 'https://www.theresidencesattheinterlock.com' },
  { name: 'Hanover West Peachtree', address: '1000 West Peachtree St NW, Atlanta, GA 30309', websiteUrl: 'https://www.hanoverwestpeachtree.com' },
  { name: 'The Collection Midtown', address: '990 Spring St NW, Atlanta, GA 30309', websiteUrl: 'https://www.thecollectionmidtown.com' },
  { name: 'Alexan on 8th', address: '695 8th St NW, Atlanta, GA 30318', websiteUrl: 'https://www.alexanon8th.com' },
  { name: 'NOVEL Midtown', address: '90 10th St NE, Atlanta, GA 30309', websiteUrl: 'https://www.novelmidtown.com' },
  { name: 'Ascent Peachtree', address: '30 Ivan Allen Jr Blvd NW, Atlanta, GA 30308', websiteUrl: 'https://www.ascentpeachtree.com' },
  { name: 'The Local on 14th', address: '1180 14th St NW, Atlanta, GA 30309', websiteUrl: 'https://www.thelocal14th.com' },
  { name: 'Alta Poncey-Highland', address: '661 Auburn Ave NE, Atlanta, GA 30312', websiteUrl: 'https://www.altaponceyhighland.com' },
  { name: 'Modera Buckhead', address: '3150 Roswell Rd NW, Atlanta, GA 30305', websiteUrl: 'https://www.moderabuckhead.com' },
  { name: 'Hanover Midtown', address: '1010 Midtown Blvd, Atlanta, GA 30309', websiteUrl: 'https://www.hanovermidtown.com' },
  { name: 'Alexan Buckhead Village', address: '310 East Paces Ferry Rd NE, Atlanta, GA 30305', websiteUrl: 'https://www.alexanbuckheadvillage.com' },
  { name: 'The Exchange at Bროokhaven', address: '3535 Peachtree Rd NE, Atlanta, GA 30326', websiteUrl: 'https://www.theexchangeatbrookhaven.com' },
  { name: 'Avana Uptown', address: '400 17th St NW, Atlanta, GA 30363', websiteUrl: 'https://www.avanauptown.com' },
  { name: 'The Olmsted', address: '842 Ralph McGill Blvd NE, Atlanta, GA 30306', websiteUrl: 'https://www.theolmstedatlanta.com' },
  { name: 'Camden Paces', address: '325 East Paces Ferry Rd NE, Atlanta, GA 30305', websiteUrl: 'https://www.camdenliving.com/atlanta-ga-apartments/camden-paces' },
  { name: 'Gables Buckhead', address: '3338 Peachtree Rd NE, Atlanta, GA 30326', websiteUrl: 'https://www.gables.com/communities/georgia/atlanta/gables-buckhead' },
  { name: 'Post Midtown', address: '905 Juniper St NE, Atlanta, GA 30309', websiteUrl: 'https://www.maapostmidtown.com' },
  { name: 'AMLI Old 4th Ward', address: '565 Glen Iris Dr NE, Atlanta, GA 30308', websiteUrl: 'https://www.amli.com/apartments/atlanta/old-fourth-ward-apartments/amli-old-4th-ward' },
  { name: 'The Darlington', address: '2025 Peachtree Rd NE, Atlanta, GA 30309', websiteUrl: 'https://www.thedarlingtonapts.com' },
  { name: 'Elan Westside', address: '500 Bishop St NW, Atlanta, GA 30318', websiteUrl: 'https://www.elanwestside.com' },
  { name: 'MAA Centennial Park', address: '225 Baker St NW, Atlanta, GA 30313', websiteUrl: 'https://www.maac.com/georgia/atlanta/centennial-park' },
  { name: 'Cortland at The Battery', address: '875 Battery Ave SE, Atlanta, GA 30339', websiteUrl: 'https://www.cortland.com/apartments/cortland-at-the-battery' },
  { name: 'The Briarcliff', address: '1900 Briarcliff Rd NE, Atlanta, GA 30329', websiteUrl: 'https://www.thebriarcliffatl.com' },
  { name: 'ARIUM Westside', address: '1500 Ellsworth Industrial Blvd NW, Atlanta, GA 30318', websiteUrl: 'https://www.ariumwestside.com' },
  { name: 'Broadstone at Lenox Park', address: '3900 Lenox Park Blvd NE, Atlanta, GA 30319', websiteUrl: 'https://www.broadstonelenoxpark.com' },
  { name: 'Windsor at Brookhaven', address: '3925 Brookhaven Manor Ct NE, Atlanta, GA 30319', websiteUrl: 'https://www.windsoratbrookhaven.com' },
  { name: 'SkyHouse Buckhead', address: '3390 Peachtree Rd NE, Atlanta, GA 30326', websiteUrl: 'https://www.skyhousebuckhead.com' },
  { name: 'SkyHouse Midtown', address: '1080 Peachtree St NE, Atlanta, GA 30309', websiteUrl: 'https://www.skyhousemidtown.com' },
  { name: 'SkyHouse South', address: '40 Ivan Allen Jr Blvd NW, Atlanta, GA 30308', websiteUrl: 'https://www.skyhousesouth.com' },
  { name: 'Piedmont House', address: '1920 Piedmont Cir NE, Atlanta, GA 30324', websiteUrl: 'https://www.piedmonthouseatlanta.com' },
  { name: 'The Byron on Peachtree', address: '1575 Peachtree St NE, Atlanta, GA 30309', websiteUrl: 'https://www.thebyronpeachtree.com' },
  { name: 'Trace at 3500', address: '3500 Lenox Rd NE, Atlanta, GA 30326', websiteUrl: 'https://www.traceat3500.com' },
  { name: 'The Flats at Ponce City Market', address: '675 Ponce De Leon Ave NE, Atlanta, GA 30308', websiteUrl: 'https://www.theflatspcm.com' },
  { name: 'Hanover Buckhead Village', address: '3045 Peachtree Rd NE, Atlanta, GA 30305', websiteUrl: 'https://www.hanoverbuckheadvillage.com' },
  { name: 'The Standard at Atlanta', address: '215 Piedmont Ave NE, Atlanta, GA 30308', websiteUrl: 'https://www.thestandard.com/atlanta' },
  { name: 'The Brady', address: '575 Ralph McGill Blvd NE, Atlanta, GA 30312', websiteUrl: 'https://www.thebradyatlanta.com' },
  { name: 'The Linden', address: '1050 Techwood Dr NW, Atlanta, GA 30318', websiteUrl: 'https://www.thelindenatlanta.com' },
  { name: 'Alta Midtown', address: '790 W Peachtree St NW, Atlanta, GA 30308', websiteUrl: 'https://www.altamidtown.com' },
  { name: 'Alexan EAV', address: '564 Flat Shoals Ave SE, Atlanta, GA 30316', websiteUrl: 'https://www.alexaneav.com' },
  { name: 'Broadstone Upper Westside', address: '710 Trabert Ave NW, Atlanta, GA 30318', websiteUrl: 'https://www.broadstoneupperwestside.com' },
  { name: 'Millworks', address: '969 Marietta St NW, Atlanta, GA 30318', websiteUrl: 'https://www.millworksatl.com' },
  { name: 'NOVEL O4W', address: '445 Glen Iris Dr NE, Atlanta, GA 30312', websiteUrl: 'https://www.novelo4w.com' },
  { name: 'The Dakota', address: '615 Glen Iris Dr NE, Atlanta, GA 30308', websiteUrl: 'https://www.thedakotaatlanta.com' },
  { name: 'Glenwood by Cortland', address: '925 Glenwood Ave SE, Atlanta, GA 30316', websiteUrl: 'https://www.cortland.com/apartments/glenwood-by-cortland' },
  { name: 'Vue at Buckhead', address: '3509 Buckhead Loop NE, Atlanta, GA 30326', websiteUrl: 'https://www.vueatbuckhead.com' },
  { name: 'Element Condos at Lindbergh', address: '250 Pharr Rd NE, Atlanta, GA 30305', websiteUrl: 'https://www.elementlindbergh.com' },
  { name: 'Vinings Lofts & Apartments', address: '3100 Paces Mill Rd SE, Atlanta, GA 30339', websiteUrl: 'https://www.viningslofts.com' },
  { name: 'Reserve at LaVista Walk', address: '2780 LaVista Rd, Decatur, GA 30033', websiteUrl: 'https://www.reservelavistawalk.com' },
  { name: 'Cortland North Druid Hills', address: '1601 Briarcliff Rd NE, Atlanta, GA 30306', websiteUrl: 'https://www.cortland.com/apartments/cortland-north-druid-hills' },
  { name: 'The Lex', address: '951 Ponce De Leon Ave NE, Atlanta, GA 30306', websiteUrl: 'https://www.thelexatlanta.com' },
  { name: 'The Palmer', address: '600 13th St NE, Atlanta, GA 30309', websiteUrl: 'https://www.thepalmeratlanta.com' },
  { name: 'Avana Westside', address: '690 17th St NW, Atlanta, GA 30363', websiteUrl: 'https://www.avanawestside.com' },
  { name: 'Elan Inman Park', address: '231 N Highland Ave NE, Atlanta, GA 30307', websiteUrl: 'https://www.elaninmanpark.com' },
  { name: 'Station R', address: '909 Fee Fee Rd, Atlanta, GA 30312', websiteUrl: 'https://www.stationratlanta.com' },
  { name: 'Link Apartments Grant Park', address: '565 Boulevard SE, Atlanta, GA 30312', websiteUrl: 'https://www.linkapartmentsgrantpark.com' },
  { name: 'MAA North Highland', address: '1000 Virginia Ave NE, Atlanta, GA 30306', websiteUrl: 'https://www.maac.com/georgia/atlanta/north-highland' },
  { name: 'The Heights at Perimeter Center', address: '6301 Peachtree Dunwoody Rd, Sandy Springs, GA 30328', websiteUrl: 'https://www.theheightsperimeter.com' },
  { name: 'Broadstone Summerhill', address: '23 Georgia Ave SE, Atlanta, GA 30312', websiteUrl: 'https://www.broadstonesummerhill.com' },
  { name: 'The Maris', address: '245 North Ave NE, Atlanta, GA 30308', websiteUrl: 'https://www.themarisatlanta.com' },
  { name: 'Cortland Perimeter Station', address: '6270 Peachtree Dunwoody Rd, Sandy Springs, GA 30328', websiteUrl: 'https://www.cortland.com/apartments/cortland-perimeter-station' },
  { name: 'ARIUM Sandy Springs', address: '6775 Roswell Rd, Sandy Springs, GA 30328', websiteUrl: 'https://www.ariumsandysprings.com' },
  { name: 'The Metropolitan at Phipps', address: '3535 Peachtree Rd NE, Atlanta, GA 30326', websiteUrl: 'https://www.metropolitanphipps.com' },
  { name: 'Avana Midtown', address: '851 Spring St NW, Atlanta, GA 30308', websiteUrl: 'https://www.avanamidtown.com' },
  { name: 'Gables 820 West', address: '820 W Peachtree St NW, Atlanta, GA 30308', websiteUrl: 'https://www.gables.com/communities/georgia/atlanta/gables-820-west' },
  { name: 'Windsor Parkview', address: '2575 Northeast Expy NE, Atlanta, GA 30345', websiteUrl: 'https://www.windsorparkview.com' },
  { name: 'AMLI Lindbergh', address: '2380 Lindbergh Dr NE, Atlanta, GA 30324', websiteUrl: 'https://www.amli.com/apartments/atlanta/lindbergh-apartments/amli-lindbergh' },
  { name: 'Cortland Biltmore', address: '1055 Piedmont Ave NE, Atlanta, GA 30309', websiteUrl: 'https://www.cortland.com/apartments/cortland-biltmore' },
  { name: 'Modera Sandy Springs', address: '6300 Powers Ferry Rd NW, Sandy Springs, GA 30339', websiteUrl: 'https://www.moderasandysprings.com' },
  { name: 'Link Apartments Linden', address: '1014 Huff Rd NW, Atlanta, GA 30318', websiteUrl: 'https://www.linkapartmentslinden.com' },
  { name: 'The Artisan', address: '1460 W Peachtree St NW, Atlanta, GA 30309', websiteUrl: 'https://www.theartisanatlanta.com' },
  { name: 'Alexan Briarcliff', address: '1900 N Druid Hills Rd NE, Atlanta, GA 30329', websiteUrl: 'https://www.alexanbriarcliff.com' },
  { name: 'Camden Fourth Ward', address: '640 Glen Iris Dr NE, Atlanta, GA 30308', websiteUrl: 'https://www.camdenliving.com/atlanta-ga-apartments/camden-fourth-ward' },
  { name: 'Post Riverside', address: '1080 River Overlook Pkwy, Atlanta, GA 30339', websiteUrl: 'https://www.maapostriverside.com' },
  { name: 'MAA Brookhaven', address: '3783 Clairmont Rd NE, Atlanta, GA 30319', websiteUrl: 'https://www.maac.com/georgia/atlanta/brookhaven' },
  { name: 'Avana on the Plaines', address: '2375 Main St NW, Duluth, GA 30096', websiteUrl: 'https://www.avanaontheplaines.com' },
  { name: 'The Georgian', address: '3015 Peachtree Rd NE, Atlanta, GA 30305', websiteUrl: 'https://www.thegeorgianatl.com' },
  { name: 'Broadstone Perimeter', address: '1220 Ashford Crossing, Dunwoody, GA 30338', websiteUrl: 'https://www.broadstoneperimeter.com' },
  { name: 'Cortland at TOBIN', address: '3350 George Busbee Pkwy NW, Kennesaw, GA 30144', websiteUrl: 'https://www.cortland.com/apartments/cortland-at-tobin' },
  { name: 'AMLI Decatur', address: '610 E College Ave, Decatur, GA 30030', websiteUrl: 'https://www.amli.com/apartments/atlanta/decatur-apartments/amli-decatur' },
  { name: 'Residences at Atlantic Station', address: '400 17th St NW, Atlanta, GA 30363', websiteUrl: 'https://www.residencesatlanticstation.com' },
  { name: 'The Vue Sandy Springs', address: '6065 Roswell Rd, Sandy Springs, GA 30328', websiteUrl: 'https://www.thevuesandysprings.com' },
  { name: 'Alexan Lenox', address: '3600 Buford Hwy NE, Atlanta, GA 30329', websiteUrl: 'https://www.alexanlenox.com' },
  { name: 'MAA West Midtown', address: '900 Huff Rd NW, Atlanta, GA 30318', websiteUrl: 'https://www.maac.com/georgia/atlanta/west-midtown' },
  { name: 'Park Apartments Buckhead', address: '3060 Pharr Court North NW, Atlanta, GA 30305', websiteUrl: 'https://www.parkapartmentsbuckhead.com' },
  { name: 'Broadstone at Vinings', address: '2901 Paces Ferry Rd SE, Atlanta, GA 30339', websiteUrl: 'https://www.broadstonevinings.com' },
  { name: 'Cortland Lenox', address: '2900 Continental Colony Pkwy SW, Atlanta, GA 30331', websiteUrl: 'https://www.cortland.com/apartments/cortland-lenox' },
  { name: 'The Retreat at Johns Creek', address: '11481 Johns Creek Pkwy, Johns Creek, GA 30097', websiteUrl: 'https://www.theretreatjohnscreek.com' },
  { name: 'AMLI Ponce Park', address: '755 Ponce De Leon Pl NE, Atlanta, GA 30306', websiteUrl: 'https://www.amli.com/apartments/atlanta/old-fourth-ward-apartments/amli-ponce-park' },
  { name: 'Windsor at East Atlanta', address: '500 Flat Shoals Ave SE, Atlanta, GA 30316', websiteUrl: 'https://www.windsoreastatlanta.com' },
  { name: 'Avalon Heights', address: '2500 Old Milton Pkwy, Alpharetta, GA 30009', websiteUrl: 'https://www.avalonheights.com' },
  { name: 'Alta Druid Hills', address: '1687 Tullie Rd NE, Atlanta, GA 30329', websiteUrl: 'https://www.altadruidhills.com' },
  { name: 'Broadstone Chandler', address: '3200 Holcomb Bridge Rd, Roswell, GA 30076', websiteUrl: 'https://www.broadstonechandler.com' },
  { name: 'Cortland at Phipps Plaza', address: '3445 Peachtree Rd NE, Atlanta, GA 30326', websiteUrl: 'https://www.cortland.com/apartments/cortland-at-phipps-plaza' },
  { name: 'Solis Parkview', address: '2000 Cheshire Bridge Rd NE, Atlanta, GA 30324', websiteUrl: 'https://www.solisparkview.com' },
  { name: 'Link Apartments Montage', address: '1300 Joseph E Boone Blvd NW, Atlanta, GA 30314', websiteUrl: 'https://www.linkapartmentsmontage.com' },
  { name: 'Citizen at Phipps', address: '3500 Lenox Rd NE, Atlanta, GA 30326', websiteUrl: 'https://www.citizenatphipps.com' },
  { name: 'NOVEL Decatur', address: '215 E Trinity Pl, Decatur, GA 30030', websiteUrl: 'https://www.noveldecatur.com' },
  { name: 'Cortland Vinings', address: '2800 Paces Ferry Rd SE, Atlanta, GA 30339', websiteUrl: 'https://www.cortland.com/apartments/cortland-vinings' },
  { name: 'Modera Decatur', address: '101 W Ponce De Leon Ave, Decatur, GA 30030', websiteUrl: 'https://www.moderadecatur.com' },
  { name: 'ARIUM Brookhaven', address: '3553 Buford Hwy NE, Atlanta, GA 30329', websiteUrl: 'https://www.ariumbrookhaven.com' },
  { name: 'The Mark at Midtown', address: '1110 W Peachtree St NW, Atlanta, GA 30309', websiteUrl: 'https://www.themarkmidtown.com' },
  { name: 'Solis North Gulch', address: '100 Ted Turner Dr SW, Atlanta, GA 30303', websiteUrl: 'https://www.solisnorthgulch.com' },
  { name: 'Cortland Galleria', address: '2475 Cumberland Pkwy SE, Atlanta, GA 30339', websiteUrl: 'https://www.cortland.com/apartments/cortland-galleria' },
];

async function seedAtlantaTargets() {
  console.log(`Seeding ${ATLANTA_TARGETS.length} Atlanta scrape targets...`);

  let inserted = 0;
  let skipped = 0;

  for (const target of ATLANTA_TARGETS) {
    try {
      const existing = await pool.query(
        `SELECT id FROM rent_scrape_targets WHERE name = $1 AND market = 'Atlanta'`,
        [target.name]
      );

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      await pool.query(
        `INSERT INTO rent_scrape_targets (name, address, website_url, market) VALUES ($1, $2, $3, 'Atlanta')`,
        [target.name, target.address, target.websiteUrl]
      );
      inserted++;
      console.log(`  Added: ${target.name}`);
    } catch (error: any) {
      console.error(`  Failed: ${target.name} — ${error.message}`);
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped (already existed)`);
  await pool.end();
}

seedAtlantaTargets().catch(console.error);
