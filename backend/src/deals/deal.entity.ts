export interface DealEntity {
  id: string;
  name?: string;
  orgId?: string;
}
export class Deal implements DealEntity {
  id: string = '';
}
export default Deal;
