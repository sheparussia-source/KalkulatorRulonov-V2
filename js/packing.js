/* Упаковка текущей партии рулонов: поддоны, прокладки, стрейч, шпули.
   Число поддонов округляется вверх от уже посчитанных рулонов на поддоне.
   Шпуля — одна на рулон. Вес шпули сюда не пересчитывается. */
function rollsForBatch(calc) {
    const targetVal = Math.max(0, state.batchOrderValue);
    const unit = state.batchOrderUnit;
    if (!(calc.netWeightKg > 0 && calc.lengthMeters > 0 && calc.areaSqM > 0)) return 0;
    if (unit === 'kg') return orderRollCount(targetVal, calc.netWeightKg);
    if (unit === 'rolls') return targetVal > 0 ? Math.ceil(targetVal) : 0;
    if (unit === 'm') return orderRollCount(targetVal, calc.lengthMeters);
    if (unit === 'sqm') return orderRollCount(targetVal, calc.areaSqM);
    if (unit === 'impr') return orderRollCount(targetVal, calc.impPerRoll.wholeCount);
    return 0;
}

function calculateBatchPacking(rolls, rollsPerPallet, interlayersPerPallet, stretchPerPallet) {
    const rollCount = Math.max(0, Number(rolls) || 0);
    const perPallet = Number(rollsPerPallet);
    const safePerPallet = perPallet > 0 ? perPallet : 1;
    const pallets = rollCount > 0 ? Math.ceil(rollCount / safePerPallet - 1e-9) : 0;
    const sheetsEach = Math.max(0, Number(interlayersPerPallet) || 0);
    const stretchEach = Math.max(0, Number(stretchPerPallet) || 0);
    return {
        rolls: rollCount,
        pallets,
        interlayers: pallets * sheetsEach,
        stretch: pallets * stretchEach,
        cores: rollCount
    };
}

function formatPackCount(n) {
    const rounded = Math.round(Number(n) || 0);
    return rounded.toLocaleString('ru-RU');
}

function formatPackAmount(n) {
    const rounded = Math.round((Number(n) || 0) * 100) / 100;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
        return Math.round(rounded).toLocaleString('ru-RU');
    }
    return rounded.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function formatPackKg(n) {
    const rounded = Math.round((Number(n) || 0) * 100) / 100;
    return rounded.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function packingLines(calc) {
    const rolls = rollsForBatch(calc);
    const perPallet = Math.max(1, Number(calc.totalRollsOnPallet) || 0);
    const pack = calculateBatchPacking(
        rolls,
        perPallet,
        state.interlayersPerPallet,
        state.stretchPerPallet
    );
    const stretchUnit = state.stretchUnit === 'm' ? 'м' : 'кг';
    return {
        pallets: formatPackCount(pack.pallets) + ' шт',
        interlayers: formatPackAmount(pack.interlayers) + ' шт',
        stretch: formatPackAmount(pack.stretch) + ' ' + stretchUnit,
        cores: formatPackCount(pack.cores) + ' шт × ' + formatPackKg(calc.coreWeightKg) + ' кг'
    };
}
