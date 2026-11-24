/* Паллета: размеры, схемы укладки, ряды и высота. Эти формулы не менялись. */
/***********************************************************************
 * 1. ПРЕДУСТАНОВЛЕННЫЕ СХЕМЫ УКЛАДКИ (9 ТИПОВЫХ + ДЛЯ 1100/1200)
 ***********************************************************************/
function generatePreloadedSchemes() {
    const s3 = Math.sqrt(3) / 2;

    function buildCenteredNormalized(pointsMm, maxD, palletW = 1200, palletH = 800) {
        if (!pointsMm.length) return [];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of pointsMm) {
            if (p.x - maxD / 2 < minX) minX = p.x - maxD / 2;
            if (p.x + maxD / 2 > maxX) maxX = p.x + maxD / 2;
            if (p.y - maxD / 2 < minY) minY = p.y - maxD / 2;
            if (p.y + maxD / 2 > maxY) maxY = p.y + maxD / 2;
        }
        const offsetX = (palletW - (maxX - minX)) / 2 - minX;
        const offsetY = (palletH - (maxY - minY)) / 2 - minY;

        return pointsMm.map(p => ({
            nx: (p.x + offsetX) / palletW,
            ny: (p.y + offsetY) / palletH
        }));
    }

    const pts24 = [];
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 6; c++) pts24.push({ x: c * 200, y: r * 200 });
    }

    const pts18 = [];
    const d18 = 240;
    for (let r = 0; r < 4; r++) {
        const count = (r % 2 === 0) ? 5 : 4;
        const xStart = (r % 2 === 0) ? 0 : d18 / 2;
        for (let c = 0; c < count; c++) pts18.push({ x: xStart + c * d18, y: r * d18 * s3 });
    }

    const pts11 = [];
    const d11 = 295;
    for (let r = 0; r < 3; r++) {
        const count = (r % 2 === 0) ? 4 : 3;
        const xStart = (r % 2 === 0) ? 0 : d11 / 2;
        for (let c = 0; c < count; c++) pts11.push({ x: xStart + c * d11, y: r * d11 * s3 });
    }

    const pts8 = [];
    const d8 = 310;
    const dx8 = d8 * 0.92;
    for (let c = 0; c < 4; c++) {
        const yShift = (c % 2 === 1) ? (d8 * 0.32) : 0;
        pts8.push({ x: c * dx8, y: yShift });
        pts8.push({ x: c * dx8, y: d8 + yShift });
    }

    const pts7 = [];
    const d7 = 325;
    for (let c = 0; c < 3; c++) {
        pts7.push({ x: c * d7, y: 0 });
        pts7.push({ x: c * d7, y: d7 });
    }
    pts7.push({ x: 2 * d7 + d7 * s3, y: d7 / 2 });

    const pts6 = [];
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) pts6.push({ x: c * 400, y: r * 400 });
    }

    const pts4 = [
        { x: 0, y: 0 },
        { x: 430, y: 0 },
        { x: 215, y: 430 * s3 },
        { x: 645, y: 430 * s3 }
    ];

    const pts3 = [
        { x: 0, y: 0 },
        { x: 720, y: 0 },
        { x: 360, y: Math.sqrt(460 * 460 - 360 * 360) }
    ];

    const pts2 = [
        { x: 0, y: 0 },
        { x: 600, y: 0 }
    ];

    const pts1 = [{ x: 0, y: 0 }];

    const pts25_sq = [];
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) pts25_sq.push({ x: c * 240, y: r * 240 });
    }
    const pts16_sq = [];
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) pts16_sq.push({ x: c * 300, y: r * 300 });
    }
    const pts12_ind = [];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) pts12_ind.push({ x: c * 300, y: r * 360 });
    }
    const pts9_sq = [];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) pts9_sq.push({ x: c * 400, y: r * 400 });
    }
    const pts6_ind = [];
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) pts6_ind.push({ x: c * 400, y: r * 550 });
    }
    const pts4_sq = [
        { x: 0, y: 0 },
        { x: 550, y: 0 },
        { x: 0, y: 550 },
        { x: 550, y: 550 }
    ];

    return [
        { id: 'std_24', title: 'Диаметр рулона до 200 мм', subtitle: '24 рулона без смещения', maxDiam: 200, rollsCount: 24, shifted: false, pallet: '1200x800', isStandard: true, points: buildCenteredNormalized(pts24, 200, 1200, 800) },
        { id: 'std_18', title: 'Диаметр рулона до 240 мм', subtitle: '18 рулонов со смещением', maxDiam: 240, rollsCount: 18, shifted: true, pallet: '1200x800', isStandard: true, points: buildCenteredNormalized(pts18, 240, 1200, 800) },
        { id: 'std_11', title: 'Диаметр рулона до 295 мм', subtitle: '11 рулонов со смещением', maxDiam: 295, rollsCount: 11, shifted: true, pallet: '1200x800', isStandard: true, points: buildCenteredNormalized(pts11, 295, 1200, 800) },
        { id: 'std_8',  title: 'Диаметр рулона до 310 мм', subtitle: '8 рулонов со смещением',  maxDiam: 310, rollsCount: 8,  shifted: true,  pallet: '1200x800', isStandard: true, points: buildCenteredNormalized(pts8, 310, 1200, 800) },
        { id: 'std_7',  title: 'Диаметр рулона до 325 мм', subtitle: '7 рулонов со смещением',  maxDiam: 325, rollsCount: 7,  shifted: true,  pallet: '1200x800', isStandard: true, points: buildCenteredNormalized(pts7, 325, 1200, 800) },
        { id: 'std_6',  title: 'Диаметр рулона до 400 мм', subtitle: '6 рулонов без смещения',  maxDiam: 400, rollsCount: 6,  shifted: false, pallet: '1200x800', isStandard: true, points: buildCenteredNormalized(pts6, 400, 1200, 800) },
        { id: 'std_4',  title: 'Диаметр рулона до 430 мм', subtitle: '4 рулона со смещением',   maxDiam: 430, rollsCount: 4,  shifted: true,  pallet: '1200x800', isStandard: true, points: buildCenteredNormalized(pts4, 430, 1200, 800) },
        { id: 'std_3',  title: 'Диаметр рулона до 460 мм', subtitle: '3 рулона со смещением',   maxDiam: 460, rollsCount: 3,  shifted: true,  pallet: '1200x800', isStandard: true, points: buildCenteredNormalized(pts3, 460, 1200, 800) },
        { id: 'std_2',  title: 'Диаметр рулона до 600 мм', subtitle: '2 рулона без смещения',   maxDiam: 600, rollsCount: 2,  shifted: false, pallet: '1200x800', isStandard: true, points: buildCenteredNormalized(pts2, 600, 1200, 800) },
        { id: 'std_1',  title: 'Диаметр рулона до 800 мм', subtitle: '1 рулон по центру',       maxDiam: 800, rollsCount: 1,  shifted: false, pallet: '1200x800', isStandard: false, points: buildCenteredNormalized(pts1, 800, 1200, 800) },
        { id: 'sq_25',  title: 'До 240 мм (1200×1200)',    subtitle: '25 рулонов (5×5)',        maxDiam: 240, rollsCount: 25, shifted: false, pallet: '1200x1200', isStandard: false, points: buildCenteredNormalized(pts25_sq, 240, 1200, 1200) },
        { id: 'sq_16',  title: 'До 300 мм (1200×1200)',    subtitle: '16 рулонов (4×4)',        maxDiam: 300, rollsCount: 16, shifted: false, pallet: '1200x1200', isStandard: false, points: buildCenteredNormalized(pts16_sq, 300, 1200, 1200) },
        { id: 'ind_12', title: 'До 300 мм (1100×1200)',    subtitle: '12 рулонов (4×3)',        maxDiam: 300, rollsCount: 12, shifted: false, pallet: '1100x1200', isStandard: false, points: buildCenteredNormalized(pts12_ind, 300, 1100, 1200) },
        { id: 'sq_9',   title: 'До 365 мм (1100/1200)',    subtitle: '9 рулонов (3×3)',         maxDiam: 365, rollsCount: 9,  shifted: false, pallet: '1100x1200', isStandard: false, points: buildCenteredNormalized(pts9_sq, 365, 1100, 1200) },
        { id: 'ind_6',  title: 'До 400 мм (1100×1200)',    subtitle: '6 рулонов (3×2)',         maxDiam: 400, rollsCount: 6,  shifted: false, pallet: '1100x1200', isStandard: false, points: buildCenteredNormalized(pts6_ind, 400, 1100, 1200) },
        { id: 'sq_4',   title: 'До 550 мм (1100/1200)',    subtitle: '4 рулона (2×2)',         maxDiam: 550, rollsCount: 4,  shifted: false, pallet: '1100x1200', isStandard: false, points: buildCenteredNormalized(pts4_sq, 550, 1100, 1200) }
    ];
}

const PALLET_DIMENSIONS = {
    '1200x800':  { w: 1200, h: 800,  name: '1200 × 800 мм (EUR)', defaultWeight: 22 },
    '1100x1200': { w: 1100, h: 1200, name: '1100 × 1200 мм (FIN/IND)', defaultWeight: 25 },
    '1200x1200': { w: 1200, h: 1200, name: '1200 × 1200 мм (Квадрат)', defaultWeight: 27 }
};

function initSchemes() {
    const base = generatePreloadedSchemes();
    let savedCustom = [];
    try {
        const raw = localStorage.getItem('rollcalc_custom_schemes_v1');
        if (raw) savedCustom = JSON.parse(raw);
    } catch (e) {
        console.warn('Ошибка чтения сохраненных схем:', e);
    }
    state.schemes = [...base, ...savedCustom];
}

function saveCustomSchemesToStorage() {
    try {
        const customOnly = state.schemes.filter(s => s.isCustom);
        localStorage.setItem('rollcalc_custom_schemes_v1', JSON.stringify(customOnly));
    } catch (e) {
        console.warn('Не удалось сохранить в localStorage:', e);
    }
}

function getActualRollPositionsMm(scheme, palletW, palletH, currentDiam, gapMm = 0) {
    if (!scheme || !scheme.points || !scheme.points.length) return [];

    const refPallet = PALLET_DIMENSIONS[scheme.pallet || '1200x800'] || { w: 1200, h: 800 };
    const effectivePitch = currentDiam + Math.max(0, gapMm);
    const rMm = currentDiam / 2;

    if (scheme.id === 'std_3' && scheme.points.length === 3) {
        const maxAllowedSpanX = Math.max(effectivePitch, palletW - currentDiam);
        let halfSpanX = Math.min(
            maxAllowedSpanX / 2,
            Math.max(
                effectivePitch * 0.72,
                Math.sqrt(Math.max(0, effectivePitch * effectivePitch - Math.pow(Math.max(0, palletH - currentDiam), 2)))
            )
        );
        if (halfSpanX >= effectivePitch) halfSpanX = effectivePitch * 0.98;

        const triangleHeightY = Math.sqrt(Math.max(0, effectivePitch * effectivePitch - halfSpanX * halfSpanX));
        const rawPts = [
            { x: -halfSpanX, y: 0 },
            { x:  halfSpanX, y: 0 },
            { x:  0,         y: triangleHeightY }
        ];

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of rawPts) {
            if (p.x - rMm < minX) minX = p.x - rMm;
            if (p.x + rMm > maxX) maxX = p.x + rMm;
            if (p.y - rMm < minY) minY = p.y - rMm;
            if (p.y + rMm > maxY) maxY = p.y + rMm;
        }
        const offsetX = (palletW - (maxX - minX)) / 2 - minX;
        const offsetY = (palletH - (maxY - minY)) / 2 - minY;

        return rawPts.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }));
    }

    const refPts = scheme.points.map(p => ({ x: p.nx * refPallet.w, y: p.ny * refPallet.h }));
    let cxRef = 0, cyRef = 0;
    for (const p of refPts) {
        cxRef += p.x;
        cyRef += p.y;
    }
    cxRef /= refPts.length;
    cyRef /= refPts.length;

    const scaleRatio = scheme.maxDiam > 0 ? (effectivePitch / scheme.maxDiam) : 1;
    const scaledPts = refPts.map(p => ({
        x: cxRef + (p.x - cxRef) * scaleRatio,
        y: cyRef + (p.y - cyRef) * scaleRatio
    }));

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of scaledPts) {
        if (p.x - rMm < minX) minX = p.x - rMm;
        if (p.x + rMm > maxX) maxX = p.x + rMm;
        if (p.y - rMm < minY) minY = p.y - rMm;
        if (p.y + rMm > maxY) maxY = p.y + rMm;
    }

    const offsetX = (palletW - (maxX - minX)) / 2 - minX;
    const offsetY = (palletH - (maxY - minY)) / 2 - minY;

    return scaledPts.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }));
}

function calculateHorizontalLayout(palletW, palletH, rollDiam, rollWidth, axisMode, gapMm = 0) {
    const dimX = (axisMode === 'along_length') ? rollWidth : rollDiam;
    const dimY = (axisMode === 'along_length') ? rollDiam : rollWidth;
    const g = Math.max(0, gapMm);

    const cols = Math.max(1, Math.floor((palletW + g) / (dimX + g)));
    const rows = Math.max(1, Math.floor((palletH + g) / (dimY + g)));

    const rects = [];
    const totalW = cols * dimX + (cols - 1) * g;
    const totalH = rows * dimY + (rows - 1) * g;
    const startX = (palletW - totalW) / 2 + dimX / 2;
    const startY = (palletH - totalH) / 2 + dimY / 2;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            rects.push({
                x: startX + c * (dimX + g),
                y: startY + r * (dimY + g),
                w: dimX,
                h: dimY
            });
        }
    }
    return {
        cols,
        rows,
        rects,
        rollsPerBottomTier: cols * rows,
        rollsAlongDiamSide: (axisMode === 'along_length') ? rows : cols
    };
}

function calculatePalletStructureForTiers(tiersCount, D, B, gap) {
    const palletDim = PALLET_DIMENSIONS[state.palletType];
    const palletWoodH = 145;
    let rollsPerTier = 0;
    let totalRollsOnPallet = 0;
    let sheetsPerPallet = 0;
    let totalHeightMm = palletWoodH;
    let maxPyramidTiers = 15;

    if (state.orientation === 'vertical') {
        const scheme = state.schemes.find(s => s.id === state.activeSchemeId) || state.schemes[0];
        rollsPerTier = scheme ? scheme.points.length : 0;
        totalRollsOnPallet = rollsPerTier * tiersCount;
        sheetsPerPallet = state.useInterlayer ? tiersCount : 0;
        const sheetsHeightAddMm = sheetsPerPallet * (state.useInterlayer ? state.interlayerThickMm : 0);
        totalHeightMm = palletWoodH + tiersCount * B + sheetsHeightAddMm;
    } else {
        const horiz = calculateHorizontalLayout(palletDim.w, palletDim.h, D, B, state.horizAxis, gap);
        rollsPerTier = horiz.rollsPerBottomTier;

        if (state.horizStackType === 'straight') {
            totalRollsOnPallet = rollsPerTier * tiersCount;
            sheetsPerPallet = state.useInterlayer ? tiersCount : 0;
            const sheetsHeightAddMm = sheetsPerPallet * (state.useInterlayer ? state.interlayerThickMm : 0);
            totalHeightMm = palletWoodH + tiersCount * D + sheetsHeightAddMm;
        } else {
            const baseCount = horiz.rollsAlongDiamSide;
            maxPyramidTiers = Math.max(1, baseCount);
            const effectiveTiers = Math.min(tiersCount, maxPyramidTiers);
            const axialRows = (state.horizAxis === 'along_length') ? horiz.cols : horiz.rows;
            let sumRolls = 0;
            for (let t = 0; t < effectiveTiers; t++) {
                const countAlongD = Math.max(0, baseCount - t);
                sumRolls += countAlongD * axialRows;
            }
            totalRollsOnPallet = sumRolls;
            sheetsPerPallet = (state.useInterlayer && effectiveTiers > 0) ? 1 : 0;
            const baseSheetH = sheetsPerPallet * (state.useInterlayer ? state.interlayerThickMm : 0);
            totalHeightMm = palletWoodH + baseSheetH + (effectiveTiers > 0 ? D + (effectiveTiers - 1) * D * (Math.sqrt(3) / 2) : 0);
        }
    }

    return {
        rollsPerTier,
        totalRollsOnPallet,
        sheetsPerPallet,
        maxPyramidTiers,
        totalHeightMm: Math.round(totalHeightMm)
    };
}

function doesSchemeFitPallet(scheme, palletW, palletH, rollDiam, gapMm) {
    const effectiveD = rollDiam + Math.max(0, gapMm);
    const allowedMaxD = (scheme.id === 'std_3') ? Math.max(scheme.maxDiam, 482) : scheme.maxDiam;
    if (effectiveD > allowedMaxD + 0.5) return false;

    const pts = getActualRollPositionsMm(scheme, palletW, palletH, rollDiam, gapMm);
    const rMm = rollDiam / 2;
    const tolerance = 2.5;

    for (const pt of pts) {
        if (
            pt.x - rMm < -tolerance ||
            pt.x + rMm > palletW + tolerance ||
            pt.y - rMm < -tolerance ||
            pt.y + rMm > palletH + tolerance
        ) {
            return false;
        }
    }

    for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
            const dist = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
            if (dist < effectiveD - 2.0) {
                return false;
            }
        }
    }

    return true;
}

function computeMaxAllowedTiers(calc) {
    let bestTiers = 1;
    const wrapW = state.useInterlayer ? state.stretchWrapWeightKg : 0;
    const sheetW = state.useInterlayer ? state.interlayerWeightKg : 0;
    const upperLimit = (state.orientation === 'horizontal' && state.horizStackType === 'pyramid')
        ? calc.maxPyramidTiers
        : 15;

    for (let t = 1; t <= upperLimit; t++) {
        const st = calculatePalletStructureForTiers(t, calc.D, calc.B, state.rollGap);
        if (st.totalRollsOnPallet <= 0) break;
        const grossW = st.totalRollsOnPallet * calc.grossWeightKg
            + state.palletWoodWeight
            + (state.useInterlayer ? st.sheetsPerPallet * sheetW + wrapW : 0);

        if (st.totalHeightMm <= state.maxHeightLimitMm && grossW <= state.maxWeightLimitKg) {
            bestTiers = t;
        } else if (t > 1) {
            break;
        }
    }
    return bestTiers;
}
