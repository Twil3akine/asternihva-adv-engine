import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateScenarios} from '../dist/tooling/index.js';
import {malformedGameFields} from './fixtures/malformed-game-registries.mjs';
const game={start:'scene-a',characters:[],scenes:{'scene-a':[{type:'end'}]}};
test('malformed top-level and registry JS fixtures report ERROR without throwing',()=>{
  for(const fields of malformedGameFields) for(const lint of [false,true]) {
    const result=validateScenarios([{id:'sample',title:'Sample',entry:{...game,...fields}}],{lint});
    assert.equal(result.valid,false);assert.ok(result.errors>0);
    assert.ok(result.diagnostics.some(d=>d.severity==='error' && d.location));
  }
});
test('registry boundary values and renderer-owned data remain accepted',()=>{
  const entry={...game,title:'',scenario:{id:'sample',title:'Sample',chapter:'ONE',description:'',order:0},audioAssets:{track:''},
    backgrounds:{room:{src:'',anchorX:0,anchorY:1,overlay:0}},
    characters:[{id:'alice',name:'Alice',renderer:'custom',assets:{custom:()=>{}},metadata:{custom:Symbol('custom')}}],
    stageLayouts:{solo:{members:[{character:'alice',position:'center',show:false}],hideOthers:false}}};
  assert.equal(validateScenarios([{id:'sample',title:'Sample',entry}]).valid,true);
});
