/**
 * M26 Tax + M27 Sale Comps Integration - Stub
 */

export class M26M27Integration {
  async triggerCompSetOnLocationSet(dealId: string): Promise<void> {
    console.log('M26/M27 integration stub called for deal:', dealId);
  }
  
  async triggerTaxProjectionOnAcquisition(dealId: string): Promise<void> {
    console.log('M26/M27 integration stub called for deal:', dealId);
  }
}

export const m26m27Integration = new M26M27Integration();
