/* Сравнение упаковки партии. Считает расход из уже готовой партии
   и стоимость по общему прайсу. Геометрию паллеты не меняет. */
const SAVED_CALCS_KEY = 'rollcalc_saved_calcs_v1';
const PACK_PRICES_KEY = 'rollcalc_pack_prices_v1';

let savedCalcs = [];

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

function loadSavedCalcs() {
    try {
        const raw = localStorage.getItem(SAVED_CALCS_KEY);
        const list = raw ? JSON.parse(raw) : [];
        savedCalcs = Array.isArray(list) ? list.filter(isSavedCalc) : [];
    } catch (e) {
        savedCalcs = [];
    }
}

function persistSavedCalcs() {
    try {
        localStorage.setItem(SAVED_CALCS_KEY, JSON.stringify(savedCalcs));
    } catch (e) {
        console.warn('Не удалось сохранить расчёты', e);
    }
}

function isSavedCalc(row) {
    return row && typeof row.id === 'string' && Array.isArray(row.params) && Number.isFinite(Number(row.rolls));
}

function priceOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function loadPackPrices() {
    const base = { pallet: 120, sheet: 3, stretch: 10, core: 1.1 };
    try {
        const raw = localStorage.getItem(PACK_PRICES_KEY);
        if (!raw) {
            state.packPrices = base;
            return;
        }
        const parsed = JSON.parse(raw);
        state.packPrices = {
            pallet: priceOr(parsed.pallet, base.pallet),
            sheet: priceOr(parsed.sheet, base.sheet),
            stretch: priceOr(parsed.stretch, base.stretch),
            core: priceOr(parsed.core, base.core)
        };
    } catch (e) {
        state.packPrices = base;
    }
}

function persistPackPrices() {
    try {
        localStorage.setItem(PACK_PRICES_KEY, JSON.stringify(state.packPrices));
    } catch (e) {
        console.warn('Не удалось сохранить прайс', e);
    }
}

function computeBatch(calc) {
    const totalRollsNeeded = rollsForBatch(calc);
    const rollsPerPallet = Math.max(1, calc.totalRollsOnPallet);
    const totalPallets = totalRollsNeeded > 0 ? Math.ceil(totalRollsNeeded / rollsPerPallet) : 0;
    const fullPallets = totalRollsNeeded > 0 ? Math.floor(totalRollsNeeded / rollsPerPallet) : 0;
    const remainderRolls = totalRollsNeeded % rollsPerPallet;

    const actualNetKg = totalRollsNeeded * calc.netWeightKg;
    const actualLengthM = totalRollsNeeded * calc.lengthMeters;
    const actualImpressionsWhole = totalRollsNeeded * calc.impPerRoll.wholeCount;

    let lastPalletRolls = remainderRolls === 0 ? (totalRollsNeeded > 0 ? rollsPerPallet : 0) : remainderRolls;
    let lastPalletTiers = 0;
    let lastPalletSheets = 0;
    let lastPalletHeightMm = 0;

    if (lastPalletRolls > 0) {
        for (let t = 1; t <= state.tiers; t++) {
            const st = calculatePalletStructureForTiers(t, calc.D, calc.B, state.rollGap);
            if (st.totalRollsOnPallet >= lastPalletRolls || t === state.tiers) {
                lastPalletTiers = t;
                lastPalletSheets = st.sheetsPerPallet;
                lastPalletHeightMm = st.totalHeightMm;
                break;
            }
        }
    }

    const lastPalletGrossKg = lastPalletRolls > 0
        ? (lastPalletRolls * calc.grossWeightKg + state.palletWoodWeight + (state.useInterlayer ? lastPalletSheets * state.interlayerWeightKg + state.stretchWrapWeightKg : 0))
        : 0;

    const totalSheetsAllPallets = state.useInterlayer
        ? (fullPallets * calc.sheetsPerPallet + (remainderRolls > 0 ? lastPalletSheets : 0))
        : 0;
    const totalWrapAllPallets = state.useInterlayer ? totalPallets * state.stretchWrapWeightKg : 0;
    const totalBatchGrossKg = totalRollsNeeded * calc.grossWeightKg
        + totalPallets * state.palletWoodWeight
        + totalSheetsAllPallets * (state.useInterlayer ? state.interlayerWeightKg : 0)
        + totalWrapAllPallets;

    return {
        totalRollsNeeded,
        rollsPerPallet,
        totalPallets,
        fullPallets,
        remainderRolls,
        actualNetKg,
        actualLengthM,
        actualImpressionsWhole,
        lastPalletRolls,
        lastPalletTiers,
        lastPalletSheets,
        lastPalletHeightMm,
        lastPalletGrossKg,
        totalSheetsAllPallets,
        totalWrapAllPallets,
        totalBatchGrossKg
    };
}

function formatPackCount(n) {
    return Math.round(Number(n) || 0).toLocaleString('ru-RU');
}

function formatMeasure(n) {
    const rounded = Math.round(Number(n) * 10) / 10;
    if (!Number.isFinite(rounded)) return '0';
    if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return Math.round(rounded).toLocaleString('ru-RU');
    return rounded.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function orderLabel() {
    const text = Math.max(0, state.batchOrderValue).toLocaleString('ru-RU');
    if (state.batchOrderUnit === 'rolls') return 'заказ ' + text + ' рул.';
    if (state.batchOrderUnit === 'm') return 'заказ ' + text + ' пог. м';
    if (state.batchOrderUnit === 'sqm') return 'заказ ' + text + ' м²';
    if (state.batchOrderUnit === 'impr') return 'заказ ' + text + ' отт.';
    return 'заказ ' + text + ' кг нетто';
}

function parameterLines(calc) {
    const pallet = PALLET_DIMENSIONS[state.palletType];
    const size = pallet ? pallet.w + '×' + pallet.h : '';
    let orient = 'на торец';
    if (state.orientation === 'horizontal') {
        orient = state.horizStackType === 'pyramid' ? 'горизонтально, пирамида' : 'горизонтально';
    }
    const packNote = state.useInterlayer ? 'с прокладками' : 'без прокладок';
    const scheme = state.schemes.find(s => s.id === state.activeSchemeId);
    const schemeLine = (state.orientation === 'vertical' && scheme) ? scheme.title : 'Горизонтальная укладка';
    return [
        'Ø ' + formatMeasure(calc.D) + ' мм · ' + formatMeasure(state.rollWidth) + ' мм · ' + formatMeasure(state.thicknessMicrons) + ' мкм',
        size + ' · ' + orient + ' · ' + state.tiers + ' яр. · ' + packNote,
        schemeLine,
        orderLabel() + ' · выс. ' + Math.round(calc.totalHeightMm).toLocaleString('ru-RU') + ' мм'
    ];
}

function comparisonCounts(batch) {
    return {
        rolls: batch.totalRollsNeeded,
        pallets: batch.totalPallets,
        grossKg: Math.round(batch.totalBatchGrossKg || 0),
        cores: batch.totalRollsNeeded,
        sheets: batch.totalSheetsAllPallets,
        stretch: batch.totalPallets,
        netKg: batch.actualNetKg
    };
}

function comparisonCost(counts) {
    const prices = state.packPrices || { pallet: 120, sheet: 3, stretch: 10, core: 1.1 };
    const rub = counts.cores * prices.core
        + counts.sheets * prices.sheet
        + counts.stretch * prices.stretch
        + counts.pallets * prices.pallet;
    return {
        rub,
        perKg: counts.netKg > 0 ? rub / counts.netKg : 0
    };
}

function formatRub(rub) {
    return Math.round(rub).toLocaleString('ru-RU') + ' ₽';
}

function formatPerKg(perKg) {
    return (Number(perKg) || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽/кг';
}

function partyLines(counts) {
    return [
        formatPackCount(counts.rolls) + ' рул.',
        formatPackCount(counts.pallets) + ' палл.',
        formatPackCount(counts.grossKg) + ' кг брутто'
    ];
}

function packCountLines(counts) {
    return [
        formatPackCount(counts.cores) + ' шпуль',
        formatPackCount(counts.sheets) + ' прокладка',
        formatPackCount(counts.stretch) + ' стрейч',
        formatPackCount(counts.pallets) + ' поддонов'
    ];
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function linesHtml(lines) {
    return lines.map(line => '<div>' + escapeHtml(line) + '</div>').join('');
}

function liveComparisonRow(calc, batch) {
    const counts = comparisonCounts(batch);
    return {
        live: true,
        title: 'Сейчас на экране',
        note: 'меняется вместе с полями',
        params: parameterLines(calc),
        counts
    };
}

function savedComparisonRow(row) {
    return {
        live: false,
        id: row.id,
        title: row.comment || 'Без комментария',
        note: '',
        params: row.params,
        counts: {
            rolls: Number(row.rolls) || 0,
            pallets: Number(row.pallets) || 0,
            grossKg: Math.round(Number(row.grossKg) || 0),
            cores: Number(row.cores) || 0,
            sheets: Number(row.sheets) || 0,
            stretch: Number(row.stretch) || 0,
            netKg: Number(row.netKg) || 0
        }
    };
}

function comparisonRows(calc, batch) {
    const rows = [liveComparisonRow(calc, batch)];
    savedCalcs.forEach(row => rows.push(savedComparisonRow(row)));
    return rows;
}

function syncPriceInput(id, value) {
    const el = document.getElementById(id);
    if (!el || document.activeElement === el) return;
    const shown = Math.abs(value - Math.round(value)) < 1e-9
        ? String(Math.round(value))
        : String(Math.round(value * 100) / 100);
    el.value = shown;
}

function renderComparison(calc, batch) {
    const body = document.getElementById('compareTableBody');
    if (!body) return;
    if (!batch) batch = computeBatch(calc);
    const prices = state.packPrices || { pallet: 120, sheet: 3, stretch: 10, core: 1.1 };
    syncPriceInput('pricePallet', prices.pallet);
    syncPriceInput('priceSheet', prices.sheet);
    syncPriceInput('priceStretch', prices.stretch);
    syncPriceInput('priceCore', prices.core);

    const hint = document.getElementById('compareEmptyHint');
    if (hint) hint.hidden = savedCalcs.length > 0;

    body.innerHTML = comparisonRows(calc, batch).map(row => {
        const cost = comparisonCost(row.counts);
        const badge = row.live
            ? '<span class="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">текущий</span>'
            : '<button type="button" class="text-slate-400 hover:text-rose-600 text-base leading-none px-1" data-delete-calc="' + escapeHtml(row.id) + '" title="Удалить">×</button>';
        const note = row.note ? '<div class="text-[11px] text-slate-400 font-normal">' + escapeHtml(row.note) + '</div>' : '';
        return '<tr>'
            + '<td class="align-top py-3 pr-3"><div class="font-semibold text-slate-800">' + escapeHtml(row.title) + '</div>' + note + '</td>'
            + '<td class="align-top py-3 pr-3 text-xs text-slate-600 leading-5">' + linesHtml(row.params) + '</td>'
            + '<td class="align-top py-3 pr-3 text-xs text-slate-700 leading-5">' + linesHtml(partyLines(row.counts)) + '</td>'
            + '<td class="align-top py-3 pr-3 text-xs text-slate-700 leading-5">' + linesHtml(packCountLines(row.counts)) + '</td>'
            + '<td class="align-top py-3 pr-3"><div class="font-semibold text-slate-900">' + escapeHtml(formatRub(cost.rub)) + '</div><div class="text-xs text-slate-500">' + escapeHtml(formatPerKg(cost.perKg)) + '</div></td>'
            + '<td class="align-top py-3 text-right">' + badge + '</td>'
            + '</tr>';
    }).join('');
}

function comparisonPrintHtml(calc) {
    const batch = computeBatch(calc);
    const prices = state.packPrices || { pallet: 120, sheet: 3, stretch: 10, core: 1.1 };
    const priceLine = 'Поддон ' + formatMeasure(prices.pallet) + ' ₽/шт · прокладка ' + formatMeasure(prices.sheet)
        + ' ₽/лист · стрейч и уголки ' + formatMeasure(prices.stretch) + ' ₽/палл. · шпуля ' + formatMeasure(prices.core) + ' ₽/шт';
    const rows = comparisonRows(calc, batch).map(row => {
        const cost = comparisonCost(row.counts);
        const title = row.live ? 'Сейчас на экране' : row.title;
        return '<tr>'
            + '<td>' + escapeHtml(title) + '</td>'
            + '<td>' + linesHtml(row.params) + '</td>'
            + '<td>' + linesHtml(partyLines(row.counts)) + '</td>'
            + '<td>' + linesHtml(packCountLines(row.counts)) + '</td>'
            + '<td>' + escapeHtml(formatRub(cost.rub)) + '<br>' + escapeHtml(formatPerKg(cost.perKg)) + '</td>'
            + '</tr>';
    }).join('');
    return '<p class="print-price-line">' + escapeHtml(priceLine) + '</p>'
        + '<table class="print-compare"><thead><tr>'
        + '<th>Вариант</th><th>Параметры</th><th>Партия</th><th>Упаковка, шт</th><th>Стоимость</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table>';
}

function saveCurrentCalc() {
    const commentEl = document.getElementById('inputCompareComment');
    const calc = calculateAll();
    const batch = computeBatch(calc);
    const counts = comparisonCounts(batch);
    savedCalcs.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        comment: commentEl ? commentEl.value.trim() : '',
        params: parameterLines(calc),
        rolls: counts.rolls,
        pallets: counts.pallets,
        grossKg: counts.grossKg,
        cores: counts.cores,
        sheets: counts.sheets,
        stretch: counts.stretch,
        netKg: counts.netKg
    });
    persistSavedCalcs();
    if (commentEl) commentEl.value = '';
    updateUI();
}

function deleteSavedCalc(id) {
    savedCalcs = savedCalcs.filter(row => row.id !== id);
    persistSavedCalcs();
    updateUI();
}
