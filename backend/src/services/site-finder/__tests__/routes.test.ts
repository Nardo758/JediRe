import {describe,it,expect,vi} from 'vitest';
import express from 'express';
import request from 'supertest';
import {createSiteFinderRoutes} from '../../../api/rest/site-finder.routes';
import {generateAccessToken} from '../../../auth/jwt';
vi.mock('../../../utils/logger',()=>({logger:{error:vi.fn(),warn:vi.fn(),info:vi.fn(),debug:vi.fn()}}));
describe('authenticated Site Finder HTTP ownership boundary',()=>{
  it('catalog dependency failure is a safe 503, never an invalid-instruction 422',async()=>{
    const query=vi.fn(async()=>{throw new Error('private database connection details');});
    const app=express();app.use(express.json());app.use('/site-finder',createSiteFinderRoutes({query} as any));
    const token='Bearer '+generateAccessToken({userId:'owner',email:'screening-test@example.invalid',role:'user'});
    for (const path of ['/catalog','/interpret','/runs']) {
      const r=path==='/catalog' ? await request(app).get('/site-finder'+path).set('Authorization',token) :
        await request(app).post('/site-finder'+path).set('Authorization',token).send({text:'Find parcels in Broward',criteria:{counties:['Broward'],limit:50}});
      expect(r.status).toBe(503);
      expect(r.body.error).toContain('backend or catalog');
      expect(JSON.stringify(r.body)).not.toContain('private');
    }
  });
  it('restores only the signed-in owners run and denies other-user restore, retry and review',async()=>{
    const id='9d9271a5-bbee-422a-a31e-a9c434398412';
    const snapshot={id,status:'complete',results:[],criteria:{counties:['Broward'],limit:1}};
    const query=vi.fn(async(sql:string,args?:string[])=>{
      if(sql.includes('WHERE id=$1 AND owner_id=$2')) return {rows:args?.[1]==='owner'? [{snapshot}] : []};
      return {rows:[]};
    });
    const app=express();app.use(express.json());app.use('/site-finder',createSiteFinderRoutes({query} as any));
    const bearer=(userId:string)=>'Bearer '+generateAccessToken({userId,email:'screening-test@example.invalid',role:'user'});
    const other=bearer('other');
    expect((await request(app).get(`/site-finder/runs/${id}`).set('Authorization',bearer('owner'))).status).toBe(200);
    expect((await request(app).get(`/site-finder/runs/${id}`).set('Authorization',other)).status).toBe(404);
    expect((await request(app).post(`/site-finder/runs/${id}/retry`).set('Authorization',other)).status).toBe(404);
    expect((await request(app).post(`/site-finder/runs/${id}/parcels/unknown/review`).set('Authorization',other)).status).toBe(404);
    expect((await request(app).get(`/site-finder/runs/${id}`)).status).toBe(401);
    expect((await request(app).get('/site-finder/runs/not-a-uuid').set('Authorization',other)).status).toBe(400);
    expect((await request(app).post('/site-finder/instructions').send({id,text:'search'})).status).toBe(401);
    expect((await request(app).post('/site-finder/instructions').set('Authorization',other).send({id,text:'x'.repeat(1001)})).status).toBe(422);
    expect((await request(app).get('/site-finder/instructions/not-a-uuid').set('Authorization',other)).status).toBe(400);
    expect((await request(app).get(`/site-finder/instructions/${id}`).set('Authorization',other)).status).toBe(404);
    expect(query.mock.calls.some(([sql])=>/INSERT INTO (deals|properties)|UPDATE deal_assumptions/.test(sql))).toBe(false);
  });
});