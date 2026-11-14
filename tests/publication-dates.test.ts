import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePublicationDates} from '../lib/publication-dates.ts';

test('event requires both start and end dates',()=>{
 assert.match(validatePublicationDates('event',{startDate:'2026-12-01'}).error??'',/datas de início/);
 assert.deepEqual(validatePublicationDates('event',{startDate:'2026-12-01',endDate:'2026-12-04'}).dates,{startDate:'2026-12-01',endDate:'2026-12-04',deadline:null});
});
test('course cannot end before it starts',()=>{
 assert.match(validatePublicationDates('course',{startDate:'2026-12-10',endDate:'2026-12-09'}).error??'',/anterior/);
});
test('opportunity requires deadline',()=>{
 assert.match(validatePublicationDates('opportunity',{}).error??'',/data limite/);
 assert.deepEqual(validatePublicationDates('opportunity',{deadline:'2026-12-15'}).dates,{startDate:null,endDate:null,deadline:'2026-12-15'});
});
test('rejects invalid calendar dates',()=>{
 assert.equal(validatePublicationDates('event',{startDate:'2026-02-30',endDate:'2026-03-01'}).dates,undefined);
});
