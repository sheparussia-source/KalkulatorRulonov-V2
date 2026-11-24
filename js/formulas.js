/* Формулы рулона. Площадь, вес, длина и диаметр считаются прежними выражениями.
   Штуки в рулоне: floor(длина мм / шаг мм), ручьи умножают только это число. */
function positiveOr(value, fallback) {
    const n = Number(value);
    return n > 0 ? n : fallback;
}

function filmLengthMeters(D, dCore, effectiveH) {
    if (!(D > dCore) || !(effectiveH > 0)) return 0;
    return (Math.PI * (D * D - dCore * dCore)) / (4 * effectiveH);
}

function formatRollMeters(meters) {
    const shown = Math.round(Number(meters) * 1000) / 1000;
    if (!Number.isFinite(shown)) return '0,000';
    return shown.toLocaleString('ru-RU', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function orderRollCount(target, perUnit) {
    if (!(target > 0) || !(perUnit > 0)) return 0;
    const n = Math.ceil(target / perUnit - 1e-9);
    return n > 0 ? n : 0;
}

function calculateImpressions(lengthMeters, printStepMm, streams) {
    if (!printStepMm || printStepMm <= 0 || lengthMeters <= 0) {
        return { wholeCount: 0, exactCount: 0 };
    }
    const k = Math.max(1, streams || 1);
    const exactSteps = (lengthMeters * 1000) / printStepMm;
    const wholeSteps = Math.floor(exactSteps + 1e-9);
    return {
        wholeCount: wholeSteps * k,
        exactCount: exactSteps * k
    };
}

function formatRemainderMm(mm) {
    const rounded = Math.round(mm * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
        return Math.round(rounded).toLocaleString('ru-RU');
    }
    return rounded.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function piecesInRoll(lengthMeters, stepMm, streams) {
    if (!stepMm || stepMm <= 0 || !(lengthMeters > 0)) return null;
    const lengthMm = lengthMeters * 1000;
    const perLane = Math.floor(lengthMm / stepMm + 1e-9);
    let remainderMm = lengthMm - perLane * stepMm;
    if (!isFinite(remainderMm) || remainderMm < 0.05) remainderMm = 0;
    const lanes = Math.max(1, streams || 1);
    return { count: perLane * lanes, remainderMm };
}

function piecesLine(lengthMeters, stepMm, streams) {
    const fit = piecesInRoll(lengthMeters, stepMm, streams);
    if (!fit) return '';
    const countText = fit.count.toLocaleString('ru-RU') + ' шт';
    if (fit.remainderMm > 0) {
        return 'В рулоне ' + countText + ', остаток ' + formatRemainderMm(fit.remainderMm) + ' мм';
    }
    return 'В рулоне ' + countText;
}

function piecesFitText(lengthMeters, stepMm, streams) {
    const fit = piecesInRoll(lengthMeters, stepMm, streams);
    if (!fit) return '';
    const countText = fit.count.toLocaleString('ru-RU') + ' шт';
    if (fit.remainderMm > 0) {
        return countText + ', остаток ' + formatRemainderMm(fit.remainderMm) + ' мм';
    }
    return countText;
}
