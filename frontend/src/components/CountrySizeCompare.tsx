import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { geoArea, geoEqualEarth, geoPath } from 'd3-geo';
import officialAreaByIso3 from '../data/officialAreaByIso3';
import './CountrySizeCompare.css';

type CountryProperties = Record<string, string | number | null>;
type CountryFeature = GeoJSON.Feature<GeoJSON.Geometry, CountryProperties>;
type GeoCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, CountryProperties>;

type CountryEntry = {
    id: string;
    iso3: string;
    label: string;
    name: string;
    areaKm2: number;
    officialAreaKm2: number | null;
    feature: CountryFeature;
};

const EARTH_RADIUS_KM = 6371;
const VIEWBOX_WIDTH = 900;
const VIEWBOX_HEIGHT = 600;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 40;
const ZOOM_STEP = 0.05;
const RANKING_LIMIT = 20;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const NAME_KEY_BY_LANGUAGE: Record<string, string> = {
    ar: 'NAME_AR',
    de: 'NAME_DE',
    el: 'NAME_EL',
    en: 'NAME_EN',
    es: 'NAME_ES',
    fa: 'NAME_FA',
    fr: 'NAME_FR',
    he: 'NAME_HE',
    hi: 'NAME_HI',
    hu: 'NAME_HU',
    id: 'NAME_ID',
    it: 'NAME_IT',
    ja: 'NAME_JA',
    ko: 'NAME_KO',
    nl: 'NAME_NL',
    pl: 'NAME_PL',
    pt: 'NAME_PT',
    ru: 'NAME_RU',
    sv: 'NAME_SV',
    tr: 'NAME_TR',
    vi: 'NAME_VI',
    zh: 'NAME_ZH',
};

const getLocalizedName = (properties: CountryFeature['properties'], language: string, fallbackLabel: string) => {
    const baseLanguage = language.split('-')[0];
    const languageKey = NAME_KEY_BY_LANGUAGE[baseLanguage] ?? 'NAME_EN';
    const localized = properties[languageKey];
    if (typeof localized === 'string' && localized.trim().length > 0) return localized;
    const fallback = properties.NAME_EN ?? properties.NAME ?? properties.ADMIN ?? properties.NAME_LONG;
    return typeof fallback === 'string' ? fallback : fallbackLabel;
};

const formatArea = (value: number, locale: string) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);

const formatRatio = (value: number, locale: string) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);

export const CountrySizeCompare = () => {
    const { t, i18n } = useTranslation();
    const [features, setFeatures] = useState<CountryFeature[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [primaryId, setPrimaryId] = useState<string>('');
    const [secondaryId, setSecondaryId] = useState<string>('');
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [primaryOffset, setPrimaryOffset] = useState({ x: 0, y: 0 });
    const [secondaryOffset, setSecondaryOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragTarget, setDragTarget] = useState<'both' | 'primary' | 'secondary'>('both');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [resolution, setResolution] = useState<'110m' | '10m'>('110m');
    const [showAllRanks, setShowAllRanks] = useState(false);
    const dragStateRef = useRef<{
        startX: number;
        startY: number;
        originPanX: number;
        originPanY: number;
        originPrimaryX: number;
        originPrimaryY: number;
        originSecondaryX: number;
        originSecondaryY: number;
        scaleX: number;
        scaleY: number;
        target: 'both' | 'primary' | 'secondary';
    } | null>(null);
    const pointerCacheRef = useRef(new Map<number, { x: number; y: number }>());
    const pinchStateRef = useRef<{
        distance: number;
        zoom: number;
        panX: number;
        panY: number;
        midX: number;
        midY: number;
        scaleX: number;
        scaleY: number;
    } | null>(null);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                setLoading(true);
                setError(false);
                const response = await fetch(`/data/countries-${resolution}.geojson`);
                if (!response.ok) throw new Error('failed to fetch');
                const data = (await response.json()) as GeoCollection;
                if (mounted) {
                    setFeatures(data.features || []);
                }
            } catch (err) {
                console.error(err);
                if (mounted) setError(true);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => {
            mounted = false;
        };
    }, [resolution]);

    const countries = useMemo(() => {
        const unknownLabel = t('Unknown');
        return features
            .map((feature) => {
                const areaSteradians = geoArea(feature);
                const areaKm2 = areaSteradians * EARTH_RADIUS_KM * EARTH_RADIUS_KM;
                const name = (feature.properties.NAME_EN as string) || (feature.properties.ADMIN as string) || unknownLabel;
                const iso3 = String(feature.properties.ADM0_A3 || feature.properties.ISO_A3 || '');
                const officialAreaKm2 = iso3 ? (officialAreaByIso3 as Record<string, number | undefined>)[iso3] ?? null : null;
                return {
                    id: iso3 || name,
                    iso3,
                    label: getLocalizedName(feature.properties, i18n.language, unknownLabel),
                    name,
                    areaKm2,
                    officialAreaKm2,
                    feature,
                } satisfies CountryEntry;
            })
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [features, i18n.language, t]);

    useEffect(() => {
        if (!countries.length) return;
        if (!primaryId) {
            const defaultPrimary = countries.find((country) => country.name === 'South Korea') ?? countries[0];
            setPrimaryId(defaultPrimary.id);
        }
        if (!secondaryId) {
            const defaultSecondary = countries.find((country) => country.name === 'United States of America')
                ?? countries[1]
                ?? countries[0];
            setSecondaryId(defaultSecondary.id);
        }
    }, [countries, primaryId, secondaryId]);

    const primary = countries.find((country) => country.id === primaryId) ?? null;
    const secondary = countries.find((country) => country.id === secondaryId) ?? null;

    const autoZoom = useMemo(() => {
        if (!primary || !secondary) return 1;
        const primaryArea = primary.officialAreaKm2 ?? primary.areaKm2;
        const secondaryArea = secondary.officialAreaKm2 ?? secondary.areaKm2;
        const biggerArea = Math.max(primaryArea, secondaryArea);
        const smallerArea = Math.max(1, Math.min(primaryArea, secondaryArea));
        const areaRatio = biggerArea / smallerArea;
        const sizeRatio = Math.sqrt(areaRatio);
        const boost = Math.log10(sizeRatio) * 0.6;
        return clamp(1 + boost, 0.9, 2.2);
    }, [primary, secondary]);

    useEffect(() => {
        if (!primary || !secondary) return;
        setZoom(autoZoom);
    }, [autoZoom, primary, secondary]);

    useEffect(() => {
        if (!isFullscreen) return;
        document.body.classList.add('cc-fullscreen-lock');
        if (window.screen?.orientation?.lock) {
            window.screen.orientation.lock('landscape').catch(() => {});
        }
        return () => {
            document.body.classList.remove('cc-fullscreen-lock');
            window.screen?.orientation?.unlock?.();
        };
    }, [isFullscreen]);

    useEffect(() => {
        setPan({ x: 0, y: 0 });
        setPrimaryOffset({ x: 0, y: 0 });
        setSecondaryOffset({ x: 0, y: 0 });
        dragStateRef.current = null;
        pointerCacheRef.current.clear();
        pinchStateRef.current = null;
        setIsDragging(false);
        setDragTarget('both');
    }, [primaryId, secondaryId, resolution]);

    const overlay = useMemo(() => {
        if (!primary || !secondary) return null;

        const projection = geoEqualEarth().scale(1).translate([0, 0]);
        const pathGenerator = geoPath(projection);

        const primaryPath = pathGenerator(primary.feature);
        const secondaryPath = pathGenerator(secondary.feature);
        if (!primaryPath || !secondaryPath) return null;

        const primaryBounds = pathGenerator.bounds(primary.feature);
        const secondaryBounds = pathGenerator.bounds(secondary.feature);

        const primaryWidth = primaryBounds[1][0] - primaryBounds[0][0];
        const primaryHeight = primaryBounds[1][1] - primaryBounds[0][1];
        const secondaryWidth = secondaryBounds[1][0] - secondaryBounds[0][0];
        const secondaryHeight = secondaryBounds[1][1] - secondaryBounds[0][1];

        const maxWidth = Math.max(primaryWidth, secondaryWidth, 1);
        const maxHeight = Math.max(primaryHeight, secondaryHeight, 1);
        const scale = Math.min((VIEWBOX_WIDTH * 0.82) / maxWidth, (VIEWBOX_HEIGHT * 0.82) / maxHeight);
        const scaled = scale * zoom;

        const primaryCenter = [
            (primaryBounds[0][0] + primaryBounds[1][0]) / 2,
            (primaryBounds[0][1] + primaryBounds[1][1]) / 2,
        ];
        const secondaryCenter = [
            (secondaryBounds[0][0] + secondaryBounds[1][0]) / 2,
            (secondaryBounds[0][1] + secondaryBounds[1][1]) / 2,
        ];

        const baseTranslate = `translate(${VIEWBOX_WIDTH / 2 + pan.x}, ${VIEWBOX_HEIGHT / 2 + pan.y}) scale(${scaled})`;

        return {
            primaryPath,
            secondaryPath,
            primaryTransform: `${baseTranslate} translate(${primaryOffset.x - primaryCenter[0]}, ${primaryOffset.y - primaryCenter[1]})`,
            secondaryTransform: `${baseTranslate} translate(${secondaryOffset.x - secondaryCenter[0]}, ${secondaryOffset.y - secondaryCenter[1]})`,
            primaryBounds,
            secondaryBounds,
            primaryCenter,
            secondaryCenter,
            scaled,
        };
    }, [primary, secondary, zoom, pan, primaryOffset, secondaryOffset]);

    const ratioData = useMemo(() => {
        if (!primary || !secondary) return null;
        const primaryArea = primary.officialAreaKm2 ?? primary.areaKm2;
        const secondaryArea = secondary.officialAreaKm2 ?? secondary.areaKm2;
        const ratio = primaryArea / secondaryArea;
        const bigger = ratio >= 1 ? primary : secondary;
        const smaller = ratio >= 1 ? secondary : primary;
        const normalizedRatio = ratio >= 1 ? ratio : 1 / ratio;
        return {
            ratio: normalizedRatio,
            bigger,
            smaller,
        };
    }, [primary, secondary]);

    const rankedCountries = useMemo(() => {
        return [...countries]
            .map((country) => ({
                ...country,
                rankingAreaKm2: country.officialAreaKm2 ?? country.areaKm2,
            }))
            .sort((a, b) => b.rankingAreaKm2 - a.rankingAreaKm2);
    }, [countries]);

    const rankById = useMemo(() => {
        const map = new Map<string, number>();
        rankedCountries.forEach((country, index) => {
            map.set(country.id, index + 1);
        });
        return map;
    }, [rankedCountries]);

    const areaBlocks = useMemo(() => {
        if (!primary || !secondary) return null;
        const primaryArea = primary.officialAreaKm2 ?? primary.areaKm2;
        const secondaryArea = secondary.officialAreaKm2 ?? secondary.areaKm2;
        const primarySize = Math.sqrt(primaryArea);
        const secondarySize = Math.sqrt(secondaryArea);
        const width = 900;
        const height = 320;
        const gap = 60;
        const maxHeight = Math.max(primarySize, secondarySize);
        const scale = Math.min((width - gap) / (primarySize + secondarySize), height / maxHeight);
        const primaryWidth = primarySize * scale;
        const primaryHeight = primarySize * scale;
        const secondaryWidth = secondarySize * scale;
        const secondaryHeight = secondarySize * scale;
        const startX = (width - (primaryWidth + secondaryWidth + gap)) / 2;
        return {
            width,
            height,
            primaryRect: {
                x: startX,
                y: (height - primaryHeight) / 2,
                width: primaryWidth,
                height: primaryHeight,
            },
            secondaryRect: {
                x: startX + primaryWidth + gap,
                y: (height - secondaryHeight) / 2,
                width: secondaryWidth,
                height: secondaryHeight,
            },
        };
    }, [primary, secondary]);

    const areaDifferences = useMemo(() => {
        const build = (country: CountryEntry) => {
            if (!country.officialAreaKm2) return null;
            const delta = ((country.areaKm2 - country.officialAreaKm2) / country.officialAreaKm2) * 100;
            return {
                delta,
                direction: delta < 0 ? 'smaller' : 'larger',
                magnitude: Math.abs(delta),
            };
        };
        return {
            primary: primary ? build(primary) : null,
            secondary: secondary ? build(secondary) : null,
        };
    }, [primary, secondary]);

    const handleSwap = () => {
        setPrimaryId(secondaryId);
        setSecondaryId(primaryId);
    };

    const handleZoomChange = (value: number) => {
        setZoom(clamp(value, MIN_ZOOM, MAX_ZOOM));
    };

    const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        pointerCacheRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointerCacheRef.current.size === 1) {
            dragStateRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                originPanX: pan.x,
                originPanY: pan.y,
                originPrimaryX: primaryOffset.x,
                originPrimaryY: primaryOffset.y,
                originSecondaryX: secondaryOffset.x,
                originSecondaryY: secondaryOffset.y,
                scaleX: rect.width ? VIEWBOX_WIDTH / rect.width : 1,
                scaleY: rect.height ? VIEWBOX_HEIGHT / rect.height : 1,
                target: dragTarget,
            };
        } else if (pointerCacheRef.current.size === 2) {
            const points = Array.from(pointerCacheRef.current.values());
            const dx = points[0].x - points[1].x;
            const dy = points[0].y - points[1].y;
            const distance = Math.hypot(dx, dy);
            const midX = (points[0].x + points[1].x) / 2;
            const midY = (points[0].y + points[1].y) / 2;
            pinchStateRef.current = {
                distance,
                zoom,
                panX: pan.x,
                panY: pan.y,
                midX,
                midY,
                scaleX: rect.width ? VIEWBOX_WIDTH / rect.width : 1,
                scaleY: rect.height ? VIEWBOX_HEIGHT / rect.height : 1,
            };
            dragStateRef.current = null;
        }
        setIsDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (!overlay) return;
        if (pointerCacheRef.current.has(event.pointerId)) {
            pointerCacheRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        }
        if (pointerCacheRef.current.size === 2 && pinchStateRef.current) {
            const points = Array.from(pointerCacheRef.current.values());
            const dx = points[0].x - points[1].x;
            const dy = points[0].y - points[1].y;
            const distance = Math.hypot(dx, dy);
            const midX = (points[0].x + points[1].x) / 2;
            const midY = (points[0].y + points[1].y) / 2;
            const ratio = pinchStateRef.current.distance ? distance / pinchStateRef.current.distance : 1;
            const nextZoom = clamp(pinchStateRef.current.zoom * ratio, MIN_ZOOM, MAX_ZOOM);
            setZoom(nextZoom);

            const scaleX = pinchStateRef.current.scaleX || 1;
            const scaleY = pinchStateRef.current.scaleY || 1;
            const dxMid = (midX - pinchStateRef.current.midX) * scaleX;
            const dyMid = (midY - pinchStateRef.current.midY) * scaleY;
            setPan({ x: pinchStateRef.current.panX + dxMid, y: pinchStateRef.current.panY + dyMid });
            return;
        }

        if (!dragStateRef.current) return;
        const {
            startX,
            startY,
            originPanX,
            originPanY,
            originPrimaryX,
            originPrimaryY,
            originSecondaryX,
            originSecondaryY,
            scaleX,
            scaleY,
            target,
        } = dragStateRef.current;
        const dx = (event.clientX - startX) * scaleX;
        const dy = (event.clientY - startY) * scaleY;
        const scaled = overlay.scaled || 1;
        const dxProjected = dx / scaled;
        const dyProjected = dy / scaled;
        const margin = 24;

        const clampOffset = (
            next: { x: number; y: number },
            bounds: [[number, number], [number, number]],
            center: [number, number],
            panValue: { x: number; y: number },
        ) => {
            const minX = (margin - VIEWBOX_WIDTH / 2 - panValue.x) / scaled - (bounds[0][0] - center[0]);
            const maxX = (VIEWBOX_WIDTH - margin - VIEWBOX_WIDTH / 2 - panValue.x) / scaled - (bounds[1][0] - center[0]);
            const minY = (margin - VIEWBOX_HEIGHT / 2 - panValue.y) / scaled - (bounds[0][1] - center[1]);
            const maxY = (VIEWBOX_HEIGHT - margin - VIEWBOX_HEIGHT / 2 - panValue.y) / scaled - (bounds[1][1] - center[1]);
            const lowX = Math.min(minX, maxX);
            const highX = Math.max(minX, maxX);
            const lowY = Math.min(minY, maxY);
            const highY = Math.max(minY, maxY);
            return {
                x: clamp(next.x, lowX, highX),
                y: clamp(next.y, lowY, highY),
            };
        };

        const clampPan = (next: { x: number; y: number }) => {
            const unionMinX = Math.min(
                overlay.primaryBounds[0][0] + primaryOffset.x - overlay.primaryCenter[0],
                overlay.secondaryBounds[0][0] + secondaryOffset.x - overlay.secondaryCenter[0],
            );
            const unionMaxX = Math.max(
                overlay.primaryBounds[1][0] + primaryOffset.x - overlay.primaryCenter[0],
                overlay.secondaryBounds[1][0] + secondaryOffset.x - overlay.secondaryCenter[0],
            );
            const unionMinY = Math.min(
                overlay.primaryBounds[0][1] + primaryOffset.y - overlay.primaryCenter[1],
                overlay.secondaryBounds[0][1] + secondaryOffset.y - overlay.secondaryCenter[1],
            );
            const unionMaxY = Math.max(
                overlay.primaryBounds[1][1] + primaryOffset.y - overlay.primaryCenter[1],
                overlay.secondaryBounds[1][1] + secondaryOffset.y - overlay.secondaryCenter[1],
            );

            const minX = margin - VIEWBOX_WIDTH / 2 - unionMinX * scaled;
            const maxX = VIEWBOX_WIDTH - margin - VIEWBOX_WIDTH / 2 - unionMaxX * scaled;
            const minY = margin - VIEWBOX_HEIGHT / 2 - unionMinY * scaled;
            const maxY = VIEWBOX_HEIGHT - margin - VIEWBOX_HEIGHT / 2 - unionMaxY * scaled;
            const lowX = Math.min(minX, maxX);
            const highX = Math.max(minX, maxX);
            const lowY = Math.min(minY, maxY);
            const highY = Math.max(minY, maxY);

            return {
                x: clamp(next.x, lowX, highX),
                y: clamp(next.y, lowY, highY),
            };
        };
        if (target === 'both') {
            const nextPan = { x: originPanX + dx, y: originPanY + dy };
            setPan(clampPan(nextPan));
        } else if (target === 'primary') {
            const nextOffset = { x: originPrimaryX + dxProjected, y: originPrimaryY + dyProjected };
            setPrimaryOffset(
                clampOffset(nextOffset, overlay.primaryBounds, overlay.primaryCenter, pan),
            );
        } else {
            const nextOffset = { x: originSecondaryX + dxProjected, y: originSecondaryY + dyProjected };
            setSecondaryOffset(
                clampOffset(nextOffset, overlay.secondaryBounds, overlay.secondaryCenter, pan),
            );
        }
    };

    const handlePointerEnd = (event: ReactPointerEvent<SVGSVGElement>) => {
        pointerCacheRef.current.delete(event.pointerId);
        if (pointerCacheRef.current.size < 2) {
            pinchStateRef.current = null;
        }
        if (pointerCacheRef.current.size === 0) {
            dragStateRef.current = null;
            setIsDragging(false);
        }
        event.currentTarget.releasePointerCapture(event.pointerId);
    };

    const primaryAreaDisplay = primary ? (primary.officialAreaKm2 ?? primary.areaKm2) : null;
    const secondaryAreaDisplay = secondary ? (secondary.officialAreaKm2 ?? secondary.areaKm2) : null;
    const primaryRank = primary ? rankById.get(primary.id) ?? null : null;
    const secondaryRank = secondary ? rankById.get(secondary.id) ?? null : null;
    const rankingList = showAllRanks ? rankedCountries : rankedCountries.slice(0, RANKING_LIMIT);

    return (
        <motion.section
            className="country-compare"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
        >
            <div className="country-compare-hero">
                <motion.div
                    className="country-compare-title"
                    initial={{ y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6 }}
                >
                    <p className="country-compare-kicker">{t('True Size Atlas')}</p>
                    <h1>{t('Compare two countries at real scale')}</h1>
                    <p className="country-compare-subtitle">
                        {t('Pick two countries to see their actual land area side by side and overlapped.')}
                    </p>
                </motion.div>
            </div>

            <div className="country-compare-controls">
                <div className="country-compare-select">
                    <label htmlFor="country-primary">{t('Country A')}</label>
                    <select
                        id="country-primary"
                        value={primaryId}
                        onChange={(event) => setPrimaryId(event.target.value)}
                    >
                        <option value="" disabled>
                            {t('Select a country')}
                        </option>
                        {countries.map((country) => (
                            <option key={country.id} value={country.id}>
                                {country.label}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    className="country-compare-swap"
                    type="button"
                    onClick={handleSwap}
                    aria-label={t('Swap countries')}
                >
                    <span className="swap-icon">{'<>'}</span>
                    <span>{t('Swap')}</span>
                </button>

                <div className="country-compare-select">
                    <label htmlFor="country-secondary">{t('Country B')}</label>
                    <select
                        id="country-secondary"
                        value={secondaryId}
                        onChange={(event) => setSecondaryId(event.target.value)}
                    >
                        <option value="" disabled>
                            {t('Select a country')}
                        </option>
                        {countries.map((country) => (
                            <option key={country.id} value={country.id}>
                                {country.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="country-compare-options">
                <div className="country-compare-select">
                    <label htmlFor="map-resolution">{t('Map detail')}</label>
                    <select
                        id="map-resolution"
                        value={resolution}
                        onChange={(event) => setResolution(event.target.value as '110m' | '10m')}
                    >
                        <option value="110m">{t('Fast (110m)')}</option>
                        <option value="10m">{t('High detail (10m)')}</option>
                    </select>
                </div>
                <p className="country-compare-note">
                    {t('Areas use CIA World Factbook totals.')}
                </p>
            </div>

            {loading && (
                <div className="country-compare-message">{t('Loading countries...')}</div>
            )}

            {!loading && error && (
                <div className="country-compare-message error">{t('Unable to load country shapes.')}</div>
            )}

            {!loading && !error && primary && secondary && (
                <>
                    <div className="country-compare-stats">
                        <div className="country-compare-stat primary">
                            <span className="stat-label">{t('Area')}</span>
                            <h3>{primary.label}</h3>
                            <p className="stat-value mono">
                                {primaryAreaDisplay ? formatArea(primaryAreaDisplay, i18n.language) : '--'} {t('km^2')}
                            </p>
                            <p className="stat-rank">
                                {primaryRank ? t('Rank #{{rank}}', { rank: primaryRank }) : t('Rank unavailable')}
                            </p>
                        </div>
                        <div className="country-compare-stat secondary">
                            <span className="stat-label">{t('Area')}</span>
                            <h3>{secondary.label}</h3>
                            <p className="stat-value mono">
                                {secondaryAreaDisplay ? formatArea(secondaryAreaDisplay, i18n.language) : '--'} {t('km^2')}
                            </p>
                            <p className="stat-rank">
                                {secondaryRank ? t('Rank #{{rank}}', { rank: secondaryRank }) : t('Rank unavailable')}
                            </p>
                        </div>
                        <div className="country-compare-stat ratio">
                            <span className="stat-label">{t('Size ratio')}</span>
                            <h3>{t('Scale difference')}</h3>
                            <p className="stat-value mono">
                                {ratioData ? `${formatRatio(ratioData.ratio, i18n.language)}x` : '--'}
                            </p>
                            {ratioData && (
                                <p className="stat-note">
                                    {t('{{bigger}} is {{ratio}}x the size of {{smaller}}', {
                                        bigger: ratioData.bigger.label,
                                        smaller: ratioData.smaller.label,
                                        ratio: formatRatio(ratioData.ratio, i18n.language),
                                    })}
                                </p>
                            )}
                        </div>
                    </div>

                    {isFullscreen && (
                        <div className="compare-fullscreen">
                            <div className={`fullscreen-map-stage${isDragging ? ' dragging' : ''}`}>
                                <svg
                                    viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                                    role="img"
                                    aria-label={t('Overlay of {{countryA}} and {{countryB}}', {
                                        countryA: primary.label,
                                        countryB: secondary.label,
                                    })}
                                    onPointerDown={handlePointerDown}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerEnd}
                                    onPointerCancel={handlePointerEnd}
                                >
                                    {overlay && (
                                        <>
                                            <path
                                                className="map-path primary"
                                                d={overlay.primaryPath}
                                                transform={overlay.primaryTransform}
                                            />
                                            <path
                                                className="map-path secondary"
                                                d={overlay.secondaryPath}
                                                transform={overlay.secondaryTransform}
                                            />
                                        </>
                                    )}
                                </svg>
                            </div>
                            <div className="fullscreen-overlay-top">
                                <div className="fullscreen-legend">
                                    <span className="legend-item primary">
                                        <span className="legend-dot" />
                                        {primary.label}
                                    </span>
                                    <span className="legend-item secondary">
                                        <span className="legend-dot" />
                                        {secondary.label}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="fullscreen-close"
                                    onClick={() => setIsFullscreen(false)}
                                    aria-label={t('Exit full screen')}
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="fullscreen-overlay-bottom">
                                <div className="fullscreen-selectors">
                                    <select
                                        id="country-primary-full"
                                        value={primaryId}
                                        onChange={(event) => setPrimaryId(event.target.value)}
                                        aria-label={t('Country A')}
                                    >
                                        {countries.map((country) => (
                                            <option key={country.id} value={country.id}>
                                                {country.label}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        className="fullscreen-swap"
                                        type="button"
                                        onClick={handleSwap}
                                        aria-label={t('Swap countries')}
                                    >
                                        ⇄
                                    </button>
                                    <select
                                        id="country-secondary-full"
                                        value={secondaryId}
                                        onChange={(event) => setSecondaryId(event.target.value)}
                                        aria-label={t('Country B')}
                                    >
                                        {countries.map((country) => (
                                            <option key={country.id} value={country.id}>
                                                {country.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="fullscreen-tools">
                                    <div className="fullscreen-zoom">
                                        <button
                                            type="button"
                                            className="zoom-button"
                                            onClick={() => handleZoomChange(zoom - ZOOM_STEP)}
                                            aria-label={t('Zoom out')}
                                            disabled={zoom <= MIN_ZOOM + 0.001}
                                        >
                                            −
                                        </button>
                                        <input
                                            type="range"
                                            className="zoom-slider"
                                            min={MIN_ZOOM}
                                            max={MAX_ZOOM}
                                            step={ZOOM_STEP}
                                            value={zoom}
                                            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                                            aria-label={t('Zoom level')}
                                        />
                                        <span className="zoom-readout mono">{Math.round(zoom * 100)}%</span>
                                        <button
                                            type="button"
                                            className="zoom-button"
                                            onClick={() => handleZoomChange(zoom + ZOOM_STEP)}
                                            aria-label={t('Zoom in')}
                                            disabled={zoom >= MAX_ZOOM - 0.001}
                                        >
                                            +
                                        </button>
                                    </div>
                                    <div className="fullscreen-move-toggle">
                                        <button
                                            type="button"
                                            className={dragTarget === 'both' ? 'active' : ''}
                                            onClick={() => setDragTarget('both')}
                                        >
                                            {t('Pan view')}
                                        </button>
                                        <button
                                            type="button"
                                            className={dragTarget === 'primary' ? 'active' : ''}
                                            onClick={() => setDragTarget('primary')}
                                        >
                                            {primary.label}
                                        </button>
                                        <button
                                            type="button"
                                            className={dragTarget === 'secondary' ? 'active' : ''}
                                            onClick={() => setDragTarget('secondary')}
                                        >
                                            {secondary.label}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isFullscreen && (
                        <motion.div
                            className="country-compare-map"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.6 }}
                        >
                        <div className="map-header-compact">
                            <div className="map-title-row">
                                <h2>{t('Overlay view')}</h2>
                                <div className="map-legend-inline">
                                    <span className="legend-item primary">
                                        <span className="legend-dot" />
                                        {primary.label}
                                    </span>
                                    <span className="legend-item secondary">
                                        <span className="legend-dot" />
                                        {secondary.label}
                                    </span>
                                </div>
                            </div>
                            <div className="map-toolbar">
                                <div className="toolbar-group">
                                    <div className="map-zoom-compact">
                                        <button
                                            type="button"
                                            onClick={() => handleZoomChange(zoom - ZOOM_STEP)}
                                            aria-label={t('Zoom out')}
                                            disabled={zoom <= MIN_ZOOM + 0.001}
                                        >
                                            −
                                        </button>
                                        <input
                                            type="range"
                                            className="zoom-slider"
                                            min={MIN_ZOOM}
                                            max={MAX_ZOOM}
                                            step={ZOOM_STEP}
                                            value={zoom}
                                            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                                            aria-label={t('Zoom level')}
                                        />
                                        <span className="mono">{Math.round(zoom * 100)}%</span>
                                        <button
                                            type="button"
                                            onClick={() => handleZoomChange(zoom + ZOOM_STEP)}
                                            aria-label={t('Zoom in')}
                                            disabled={zoom >= MAX_ZOOM - 0.001}
                                        >
                                            +
                                        </button>
                                    </div>
                                    <div className="map-move-compact" role="group">
                                        <button
                                            type="button"
                                            className={dragTarget === 'both' ? 'active' : ''}
                                            onClick={() => setDragTarget('both')}
                                            title={t('Pan view')}
                                        >
                                            ⊞
                                        </button>
                                        <button
                                            type="button"
                                            className={dragTarget === 'primary' ? 'active primary-btn' : 'primary-btn'}
                                            onClick={() => setDragTarget('primary')}
                                            title={primary.label}
                                        >
                                            A
                                        </button>
                                        <button
                                            type="button"
                                            className={dragTarget === 'secondary' ? 'active secondary-btn' : 'secondary-btn'}
                                            onClick={() => setDragTarget('secondary')}
                                            title={secondary.label}
                                        >
                                            B
                                        </button>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="expand-btn"
                                    onClick={() => setIsFullscreen(true)}
                                    aria-label={t('Full screen')}
                                >
                                    ⛶
                                </button>
                            </div>
                        </div>
                        <div className={`map-stage${isDragging ? ' dragging' : ''}`}>
                            <svg
                                viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                                role="img"
                                aria-label={t('Overlay of {{countryA}} and {{countryB}}', {
                                    countryA: primary.label,
                                    countryB: secondary.label,
                                })}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerEnd}
                                onPointerCancel={handlePointerEnd}
                            >
                                {overlay && (
                                    <>
                                        <path
                                            className="map-path primary"
                                            d={overlay.primaryPath}
                                            transform={overlay.primaryTransform}
                                        />
                                        <path
                                            className="map-path secondary"
                                            d={overlay.secondaryPath}
                                            transform={overlay.secondaryTransform}
                                        />
                                    </>
                                )}
                            </svg>
                        </div>
                        <p className="map-footnote">
                            {t('Map data: Natural Earth 1:{{scale}}.', { scale: resolution })}
                        </p>
                        </motion.div>
                    )}

                    <motion.div
                        className="country-compare-blocks"
                        initial={{ y: 18, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                    >
                        <div className="map-header">
                            <div className="map-title">
                                <h2>{t('Area blocks (official)')}</h2>
                                <p>{t('Squares are sized by official total area.')}</p>
                            </div>
                            <div className="map-legend">
                                <span className="legend-item primary">
                                    <span className="legend-dot" />
                                    {primary.label}
                                </span>
                                <span className="legend-item secondary">
                                    <span className="legend-dot" />
                                    {secondary.label}
                                </span>
                            </div>
                        </div>
                        <div className="block-stage">
                            <svg viewBox="0 0 900 320" role="img" aria-label={t('Area blocks (official)')}>
                                {areaBlocks && (
                                    <>
                                        <rect
                                            className="block-rect primary"
                                            x={areaBlocks.primaryRect.x}
                                            y={areaBlocks.primaryRect.y}
                                            width={areaBlocks.primaryRect.width}
                                            height={areaBlocks.primaryRect.height}
                                        />
                                        <rect
                                            className="block-rect secondary"
                                            x={areaBlocks.secondaryRect.x}
                                            y={areaBlocks.secondaryRect.y}
                                            width={areaBlocks.secondaryRect.width}
                                            height={areaBlocks.secondaryRect.height}
                                        />
                                    </>
                                )}
                            </svg>
                        </div>
                        <div className="block-diff">
                            {primary && (
                                <p>
                                    {areaDifferences.primary
                                        ? areaDifferences.primary.direction === 'smaller'
                                            ? t('Map polygon is {{value}}% smaller than official area for {{country}}.', {
                                                value: formatRatio(areaDifferences.primary.magnitude, i18n.language),
                                                country: primary.label,
                                            })
                                            : t('Map polygon is {{value}}% larger than official area for {{country}}.', {
                                                value: formatRatio(areaDifferences.primary.magnitude, i18n.language),
                                                country: primary.label,
                                            })
                                        : t('Official area unavailable for {{country}}; using map polygon.', {
                                            country: primary.label,
                                        })}
                                </p>
                            )}
                            {secondary && (
                                <p>
                                    {areaDifferences.secondary
                                        ? areaDifferences.secondary.direction === 'smaller'
                                            ? t('Map polygon is {{value}}% smaller than official area for {{country}}.', {
                                                value: formatRatio(areaDifferences.secondary.magnitude, i18n.language),
                                                country: secondary.label,
                                            })
                                            : t('Map polygon is {{value}}% larger than official area for {{country}}.', {
                                                value: formatRatio(areaDifferences.secondary.magnitude, i18n.language),
                                                country: secondary.label,
                                            })
                                        : t('Official area unavailable for {{country}}; using map polygon.', {
                                            country: secondary.label,
                                        })}
                                </p>
                            )}
                        </div>
                    </motion.div>

                    <motion.div
                        className="country-compare-ranking"
                        initial={{ y: 16, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <div className="ranking-header">
                            <div className="map-title">
                                <h2>{t('World area ranking')}</h2>
                                <p>{t('Ranks use official total area.')}</p>
                            </div>
                            <button
                                type="button"
                                className="ranking-toggle"
                                onClick={() => setShowAllRanks((prev) => !prev)}
                            >
                                {showAllRanks ? t('Show top 20') : t('Show all')}
                            </button>
                        </div>
                        <div className="ranking-list">
                            {rankingList.map((country, index) => {
                                const rank = rankById.get(country.id) ?? index + 1;
                                const isPrimary = primary?.id === country.id;
                                const isSecondary = secondary?.id === country.id;
                                return (
                                    <div
                                        key={country.id}
                                        className={`ranking-row${isPrimary ? ' primary' : ''}${isSecondary ? ' secondary' : ''}`}
                                    >
                                        <span className="ranking-index mono">#{rank}</span>
                                        <span className="ranking-name">{country.label}</span>
                                        <span className="ranking-area mono">
                                            {formatArea(country.rankingAreaKm2, i18n.language)} {t('km^2')}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                </>
            )}
        </motion.section>
    );
};
