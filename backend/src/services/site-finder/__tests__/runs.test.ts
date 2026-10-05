import {describe,it,expect,vi} from 'vitest';
import {SiteFinderRuns} from '../runs';
vi.mock('../../../utils/logger',()=>({logger:{error:vi.fn(),warn:vi.fn(),info:vi.fn(),debug:vi.fn()}}));
describe('durable user-scoped search runs',()=>{
  it('scopes restore/history queries by owner and hides other users runs',async()=>{
    const query=vi.fn().mockResolvedValue({rows:[]});
    const runs=new SiteFinderRuns({query} as any);
    const id='9d9271a5-bbee-422a-a31e-a9c434398412';
    expect(await runs.get(id,'second-user')).toBeNull();
    await runs.list('second-user');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE id=$1 AND owner_id=$2'),[id,'second-user']);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE owner_id=$1'),['second-user']);
    expect(await runs.updateReview('second-user',id,'unknown')).toBeNull();
    runs.stop();
  });
});