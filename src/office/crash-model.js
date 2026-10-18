// Conditional, terminal paper arithmetic. Crypto loss never determines a stock price here.
export const cents = value => Math.round((value + Number.EPSILON) * 100) / 100
export function putScenario(p, { stockDrop = .9, path = 'expiry', collection = 1, entrySlippage = 0 } = {}) {
  const values = [p.spot, p.strike, p.ask, p.contracts, p.multiplier, p.fee, p.allocation, stockDrop, collection, entrySlippage]
  if (!values.every(Number.isFinite) || p.spot <= 0 || p.strike <= 0 || p.ask <= 0 ||
    !Number.isSafeInteger(p.contracts) || p.contracts < 1 || p.multiplier <= 0 || p.fee < 0 ||
    p.allocation <= 0 || stockDrop < 0 || stockDrop > 1 || collection < 0 || collection > 1 ||
    entrySlippage < 0 || entrySlippage > 1 || !['expiry','recovery','late'].includes(path)) throw Error('Invalid paper scenario')
  const cost = cents(p.contracts * (p.ask * (1 + entrySlippage) * p.multiplier + p.fee))
  const terminalSpot = path === 'expiry' ? p.spot * (1 - stockDrop) : p.spot
  const gross = cents(Math.max(0, p.strike - terminalSpot) * p.multiplier * p.contracts)
  const exitFee = gross > 0 ? cents(p.contracts * p.fee) : 0
  const netProceeds = cents(Math.max(0, gross - exitFee))
  const pnl = cents(netProceeds - cost)
  return { cost, unspent: cents(p.allocation - cost), terminalSpot, gross, exitFee, netProceeds, pnl,
    endingValue: cents(p.allocation + pnl), returnPct: pnl / cost * 100,
    cashCollected: cents(netProceeds * collection), uncollectedClaim: cents(netProceeds * (1 - collection)),
    maxLoss: cost, maxNetProfit: cents(p.strike * p.multiplier * p.contracts - p.contracts * p.fee - cost),
    breakEvenStock: p.strike - (cost + p.contracts * p.fee) / (p.multiplier * p.contracts) }
}

export function fundingScenario(f, cryptoDrop, stableShare = 0) {
  if (![cryptoDrop, stableShare].every(v => Number.isFinite(v) && v >= 0 && v <= 1) ||
    ![f.debt, f.collateral, f.cash, f.margin, f.liquidation].every(Number.isFinite) || f.debt <= 0) throw Error('Invalid funding scenario')
  const collateral = f.collateral * (stableShare + (1 - stableShare) * (1 - cryptoDrop))
  return { collateral, coverage: collateral / f.debt,
    topUpToMargin: Math.max(0, f.debt * f.margin - collateral),
    topUpToInitial: Math.max(0, f.collateral - collateral),
    loanOnlyCashGapIfFullyRecalled: Math.max(0, f.debt - f.cash),
    postLoanCashIfAccessible: f.cash - f.debt,
    // An urgent margin threshold is not silently relabeled as a liquidation boundary.
    belowMargin: collateral < f.debt * f.margin,
    belowLiquidation: f.liquidation > 0 && collateral < f.debt * f.liquidation }
}
