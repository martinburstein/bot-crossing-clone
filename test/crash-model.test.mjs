import test from 'node:test'
import assert from 'node:assert/strict'
import { putScenario, fundingScenario } from '../src/office/crash-model.js'
const p = { spot:20, strike:10, ask:2, contracts:10, multiplier:100, fee:.65, allocation:11000 }
test('terminal intrinsic, both modeled fees, and cash reconcile with independent hand arithmetic', () => {
  const r = putScenario(p, { stockDrop:.75 })
  assert.equal(r.cost, 2006.5); assert.equal(r.gross, 5000); assert.equal(r.pnl, 2987)
  assert.equal(r.endingValue, 13987); assert.equal(r.maxNetProfit, 7987)
})
test('zero stock caps long-put gains; late and recovered crashes do not award a crash payout', () => {
  assert.equal(putScenario(p, { stockDrop:1 }).pnl, 7987)
  assert.equal(putScenario(p, { stockDrop:1, path:'late' }).pnl, -2006.5)
  assert.equal(putScenario(p, { stockDrop:1, path:'recovery' }).pnl, -2006.5)
  const itm = putScenario({ ...p, spot:5 }, { stockDrop:1, path:'late' })
  assert.equal(itm.gross, 5000) // Late crash does not erase pre-existing intrinsic value.
})
test('blocked collection changes immediate cash, not the modeled contractual claim', () => {
  const r = putScenario(p, { stockDrop:1, collection:0 })
  assert.equal(r.pnl, 7987); assert.equal(r.cashCollected, 0); assert.equal(r.uncollectedClaim, 9993.5)
})
test('invalid inputs fail; underfunded allocations remain visibly negative unspent', () => {
  assert.throws(() => putScenario(p,{stockDrop:1.1}))
  assert.throws(() => putScenario({...p,contracts:1.5}))
  assert.equal(putScenario({...p,allocation:1000}).unspent, -1006.5)
})
test('stable collateral weakens UPXI-style triggers; cash defeats a loan-only bankruptcy inference', () => {
  const f = { debt:100,collateral:200,cash:10,margin:1.5,liquidation:1.15 }
  assert.equal(fundingScenario(f,.5).belowLiquidation,true)
  assert.equal(fundingScenario(f,.5,.75).belowMargin,false)
  assert.equal(fundingScenario({...f,cash:200},.9).loanOnlyCashGapIfFullyRecalled,0)
})
