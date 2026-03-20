const VWORLD_GEOCODER_URL = "https://api.vworld.kr/req/address";
const VWORLD_WFS_URL = "https://api.vworld.kr/req/wfs";

type GeocodeResult = {
  input: {
    original: string;
    normalized: string;
    inferredType: "ROAD" | "PARCEL";
  };
  parsedAddress: {
    text: string;
    type: string;
    roadAddress: string | null;
    parcelAddress: string | null;
    region: {
      level1: string | null;
      level2: string | null;
      level3: string | null;
      level4L: string | null;
      level5: string | null;
      detail: string | null;
    };
    point: {
      x: number;
      y: number;
    };
  };
  raw: Record<string, unknown>;
};

export type PnuInfo = {
  fullPnu: string | null;
  legalDongCode: string | null;
  mountainYn: "1" | "2" | null;
  mainNumber: string | null;
  subNumber: string | null;
  parcelKey: string | null;
  source: string[];
  resolved: boolean;
  unresolvedReason: string | null;
};

export type ParcelInfo = {
  parcelAddress: string | null;
  lotNumber: string | null;
  mountainYn: boolean | null;
  mainNumber: string | null;
  subNumber: string | null;
  landCategory: string | null;
  areaSqm: number | null;
  areaSource: string | null;
};

export type IntegratedLandUse = {
  useAreas: string[];
  useDistricts: string[];
  useZones: string[];
  urbanFacilities: string[];
  districtPlans: string[];
  notices: Array<{
    title: string;
    announcedAt: string | null;
    description: string | null;
  }>;
  coordinate: {
    x: number;
    y: number;
  };
};

export type RegulationChecklist = {
  confirmed: string[];
  needsReview: string[];
  possibilities: string[];
};

export type IntegratedLookupResult = {
  address: {
    input: string;
    normalized: string;
    roadAddress: string | null;
    parcelAddress: string | null;
    displayAddress: string;
    coordinate: {
      x: number;
      y: number;
    };
  };
  pnu: PnuInfo;
  parcel: ParcelInfo;
  landUse: IntegratedLandUse;
  officialPrice: {
    value: number | null;
    source: string | null;
  };
  roadCondition: {
    status: string | null;
    source: string | null;
  };
  regulationChecklist: RegulationChecklist;
  raw: Record<string, unknown>;
};

type LayerCatalogItem = {
  typeName: string;
  category: keyof Pick<IntegratedLandUse, "useAreas" | "useDistricts" | "useZones">;
  label: string;
};

const LAYER_CATALOG: LayerCatalogItem[] = [
  { typeName: "lt_c_uq111", category: "useAreas", label: "도시지역" },
  { typeName: "lt_c_uq112", category: "useAreas", label: "관리지역" },
  { typeName: "lt_c_uq113", category: "useAreas", label: "농림지역" },
  { typeName: "lt_c_uq114", category: "useAreas", label: "자연환경보전지역" },
  { typeName: "lt_c_uq115", category: "useAreas", label: "기타지역" },
  { typeName: "lt_c_uq121", category: "useDistricts", label: "경관지구" },
  { typeName: "lt_c_uq123", category: "useDistricts", label: "고도지구" },
  { typeName: "lt_c_uq124", category: "useDistricts", label: "방화지구" },
  { typeName: "lt_c_uq125", category: "useDistricts", label: "방재지구" },
  { typeName: "lt_c_uq126", category: "useDistricts", label: "보호지구" },
  { typeName: "lt_c_uq128", category: "useDistricts", label: "취락지구" },
  { typeName: "lt_c_uq129", category: "useDistricts", label: "개발진흥지구" },
  { typeName: "lt_c_uq130", category: "useDistricts", label: "특정용도제한지구" },
  { typeName: "lt_c_uq141", category: "useZones", label: "국토계획구역" },
  { typeName: "lt_c_uq162", category: "useZones", label: "도시자연공원구역" },
  { typeName: "lt_c_ud801", category: "useZones", label: "개발제한구역" },
  { typeName: "lt_c_um000", category: "useZones", label: "가축사육제한구역" },
  { typeName: "lt_c_uma100", category: "useZones", label: "국립공원용도지구" },
];

const FACILITY_KEYS = ["fac_name", "FAC_NAME", "facility", "FACILITY", "fclty_nm", "FCLTY_NM"];
const DISTRICT_PLAN_KEYS = ["plan_name", "PLAN_NAME", "dstrct_nm", "DSTRCT_NM", "unit_plan", "UNIT_PLAN"];
const LAND_CATEGORY_KEYS = ["lndcgr", "LNDCGR", "jimok", "JIMOK", "jimok_nm", "JIMOK_NM"];
const AREA_KEYS = ["area", "AREA", "parea", "PAREA", "ar", "AR", "land_area", "LAND_AREA"];
const OFFICIAL_PRICE_KEYS = [
  "pblntfpc",
  "PBLNTFPC",
  "official_price",
  "OFFICIAL_PRICE",
  "land_price",
  "LAND_PRICE",
  "price",
  "PRICE",
  "gongsi",
  "GONGSI",
];
const ROAD_CONDITION_KEYS = [
  "road_side",
  "ROAD_SIDE",
  "road_cond",
  "ROAD_COND",
  "road_condition",
  "ROAD_CONDITION",
  "dorojogeon",
  "DOROJOGEON",
  "도로조건",
];

function getApiKey() {
  if (!process.env.VWORLD_API_KEY) {
    throw new Error("VWORLD_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  return process.env.VWORLD_API_KEY;
}

export function normalizeAddress(input: string) {
  return input.replace(/\s+/g, " ").replace(/[^\S\r\n]+/g, " ").trim();
}

function inferAddressType(input: string): "ROAD" | "PARCEL" {
  return /(\d{1,4}-\d{1,4}|\d{1,4}번지|리\s*\d+)/.test(input) ? "PARCEL" : "ROAD";
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`외부 API 호출에 실패했습니다. (${response.status})`);
  }

  return (await response.json()) as T;
}

async function geocodeByType(address: string, type: "ROAD" | "PARCEL") {
  const url = new URL(VWORLD_GEOCODER_URL);
  url.searchParams.set("service", "address");
  url.searchParams.set("request", "getcoord");
  url.searchParams.set("version", "2.0");
  url.searchParams.set("crs", "epsg:4326");
  url.searchParams.set("format", "json");
  url.searchParams.set("type", type.toLowerCase());
  url.searchParams.set("refine", "true");
  url.searchParams.set("simple", "false");
  url.searchParams.set("address", address);
  url.searchParams.set("key", getApiKey());

  return fetchJson<Record<string, unknown>>(url);
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function readPropertyString(properties: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = readString(properties[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function readPropertyNumber(properties: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = readNumber(properties[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function extractGeocodeResult(
  originalInput: string,
  normalized: string,
  inferredType: "ROAD" | "PARCEL",
  raw: Record<string, unknown>,
): GeocodeResult {
  const response = raw.response as Record<string, unknown> | undefined;
  const status = response?.status;

  if (status !== "OK") {
    const error = response?.error as Record<string, unknown> | undefined;
    const message = typeof error?.text === "string" ? error.text : "주소를 좌표로 변환하지 못했습니다.";
    throw new Error(message);
  }

  const refined = response?.refined as Record<string, unknown> | undefined;
  const structure = refined?.structure as Record<string, unknown> | undefined;
  const result = response?.result as Record<string, unknown> | undefined;
  const point = result?.point as Record<string, unknown> | undefined;

  const x = Number(point?.x);
  const y = Number(point?.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("좌표 정보를 확인하지 못했습니다.");
  }

  const refinedText = typeof refined?.text === "string" ? refined.text : normalized;
  const type = typeof response?.input === "object" && response.input
    ? ((response.input as Record<string, unknown>).type as string | undefined) ?? inferredType
    : inferredType;

  return {
    input: {
      original: originalInput,
      normalized,
      inferredType,
    },
    parsedAddress: {
      text: refinedText,
      type,
      roadAddress: type === "ROAD" ? refinedText : null,
      parcelAddress: type === "PARCEL" ? refinedText : null,
      region: {
        level1: readString(structure?.level1),
        level2: readString(structure?.level2),
        level3: readString(structure?.level3),
        level4L: readString(structure?.level4L),
        level5: readString(structure?.level5),
        detail: readString(structure?.detail),
      },
      point: {
        x,
        y,
      },
    },
    raw,
  };
}

async function queryLayer(typeName: string, x: number, y: number) {
  const epsilon = 0.00015;
  const url = new URL(VWORLD_WFS_URL);

  url.searchParams.set("SERVICE", "WFS");
  url.searchParams.set("VERSION", "1.1.0");
  url.searchParams.set("REQUEST", "GetFeature");
  url.searchParams.set("TYPENAME", typeName);
  url.searchParams.set("BBOX", `${x - epsilon},${y - epsilon},${x + epsilon},${y + epsilon}`);
  url.searchParams.set("SRSNAME", "EPSG:4326");
  url.searchParams.set("OUTPUT", "application/json");
  url.searchParams.set("MAXFEATURES", "20");
  url.searchParams.set("KEY", getApiKey());

  return fetchJson<Record<string, unknown>>(url);
}

function getLayerFeatures(rawLayer: Record<string, unknown>) {
  return Array.isArray(rawLayer.features) ? rawLayer.features : [];
}

function pickFeatureLabels(rawLayer: Record<string, unknown>, fallbackLabel: string) {
  const features = getLayerFeatures(rawLayer);

  return features
    .map((feature) => {
      const properties = typeof feature === "object" && feature
        ? ((feature as Record<string, unknown>).properties as Record<string, unknown> | undefined)
        : undefined;

      const alias = properties ? readString(properties.alias ?? properties.ALIAS) : null;
      const uname = properties ? readString(properties.uname ?? properties.UNAME) : null;
      const remark = properties ? readString(properties.remark ?? properties.REMARK) : null;
      const ntfdate = properties ? readString(properties.ntfdate ?? properties.NTFDATE) : null;

      return {
        label: alias ?? uname ?? fallbackLabel,
        remark,
        ntfdate,
      };
    })
    .filter((item) => Boolean(item.label));
}

function uniqueStrings(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function extractLegalDongCode(raw: Record<string, unknown>) {
  const response = raw.response as Record<string, unknown> | undefined;
  const refined = response?.refined as Record<string, unknown> | undefined;
  const structure = refined?.structure as Record<string, unknown> | undefined;
  const input = response?.input as Record<string, unknown> | undefined;

  const candidates = [
    structure?.admcode,
    structure?.admCode,
    structure?.bcode,
    structure?.bdcode,
    structure?.code,
    refined?.admcode,
    refined?.code,
    input?.admcode,
  ];

  for (const candidate of candidates) {
    const value = readString(candidate);
    if (value && /^\d{10}$/.test(value)) {
      return value;
    }
  }

  return null;
}

function extractParcelNumbers(addressText: string | null): {
  mountainYn: "1" | "2" | null;
  mainNumber: string | null;
  subNumber: string | null;
  lotNumber: string | null;
} {
  if (!addressText) {
    return {
      mountainYn: null,
      mainNumber: null,
      subNumber: null,
      lotNumber: null,
    };
  }

  const mountain = /산\s*/.test(addressText);
  const match = addressText.match(/(산)?\s*(\d+)(?:-(\d+))?/);

  return {
    mountainYn: mountain ? "2" : "1",
    mainNumber: match?.[2]?.padStart(4, "0") ?? null,
    subNumber: (match?.[3] ?? "0").padStart(4, "0"),
    lotNumber: match ? `${match[1] ? "산" : ""}${match[2]}${match[3] ? `-${match[3]}` : ""}` : null,
  };
}

function buildPnu(geocode: GeocodeResult): PnuInfo {
  const legalDongCode = extractLegalDongCode(geocode.raw);
  const parcel = extractParcelNumbers(geocode.parsedAddress.parcelAddress ?? geocode.parsedAddress.text);
  const source: string[] = [];

  if (legalDongCode) {
    source.push("법정동코드");
  }

  if (parcel.mainNumber) {
    source.push("지번 본번");
  }

  if (parcel.subNumber) {
    source.push("지번 부번");
  }

  const fullPnu =
    legalDongCode && parcel.mountainYn && parcel.mainNumber && parcel.subNumber
      ? `${legalDongCode}${parcel.mountainYn}${parcel.mainNumber}${parcel.subNumber}`
      : null;

  return {
    fullPnu,
    legalDongCode,
    mountainYn: parcel.mountainYn,
    mainNumber: parcel.mainNumber,
    subNumber: parcel.subNumber,
    parcelKey: parcel.lotNumber,
    source,
    resolved: Boolean(fullPnu),
    unresolvedReason: fullPnu ? null : "법정동코드 또는 지번 정보가 부족해 19자리 PNU를 완성하지 못했습니다.",
  };
}

function buildParcelInfo(geocode: GeocodeResult, rawLayers: Record<string, unknown>): ParcelInfo {
  const parcel = extractParcelNumbers(geocode.parsedAddress.parcelAddress ?? geocode.parsedAddress.text);

  for (const layer of Object.values(rawLayers)) {
    if (!layer || typeof layer !== "object") {
      continue;
    }

    for (const feature of getLayerFeatures(layer as Record<string, unknown>)) {
      const properties = typeof feature === "object" && feature
        ? ((feature as Record<string, unknown>).properties as Record<string, unknown> | undefined)
        : undefined;

      if (!properties) {
        continue;
      }

      const landCategory = readPropertyString(properties, LAND_CATEGORY_KEYS);
      const areaSqm = readPropertyNumber(properties, AREA_KEYS);

      if (landCategory || areaSqm !== null) {
        return {
          parcelAddress: geocode.parsedAddress.parcelAddress,
          lotNumber: parcel.lotNumber,
          mountainYn: parcel.mountainYn === "2",
          mainNumber: parcel.mainNumber,
          subNumber: parcel.subNumber,
          landCategory,
          areaSqm,
          areaSource: areaSqm !== null ? "공공 속성값" : null,
        };
      }
    }
  }

  return {
    parcelAddress: geocode.parsedAddress.parcelAddress,
    lotNumber: parcel.lotNumber,
    mountainYn: parcel.mountainYn === null ? null : parcel.mountainYn === "2",
    mainNumber: parcel.mainNumber,
    subNumber: parcel.subNumber,
    landCategory: null,
    areaSqm: null,
    areaSource: null,
  };
}

function collectLayerPropertySummary(rawLayers: Record<string, unknown>) {
  const urbanFacilities: string[] = [];
  const districtPlans: string[] = [];
  const roadConditionCandidates: string[] = [];
  const officialPriceCandidates: number[] = [];

  for (const [typeName, layer] of Object.entries(rawLayers)) {
    if (!layer || typeof layer !== "object") {
      continue;
    }

    for (const feature of getLayerFeatures(layer as Record<string, unknown>)) {
      const properties = typeof feature === "object" && feature
        ? ((feature as Record<string, unknown>).properties as Record<string, unknown> | undefined)
        : undefined;

      if (!properties) {
        continue;
      }

      const facilityName = readPropertyString(properties, FACILITY_KEYS);
      if (facilityName) {
        urbanFacilities.push(facilityName);
      }

      const districtPlanName = readPropertyString(properties, DISTRICT_PLAN_KEYS);
      if (districtPlanName) {
        districtPlans.push(districtPlanName);
      }

      const roadCondition = readPropertyString(properties, ROAD_CONDITION_KEYS);
      if (roadCondition) {
        roadConditionCandidates.push(`${roadCondition} (${typeName})`);
      }

      const officialPrice = readPropertyNumber(properties, OFFICIAL_PRICE_KEYS);
      if (officialPrice !== null) {
        officialPriceCandidates.push(officialPrice);
      }
    }
  }

  return {
    urbanFacilities: uniqueStrings(urbanFacilities),
    districtPlans: uniqueStrings(districtPlans),
    roadConditionCandidates: uniqueStrings(roadConditionCandidates),
    officialPriceCandidates,
  };
}

function buildRegulationChecklist(
  landUse: IntegratedLandUse,
  parcel: ParcelInfo,
  officialPrice: IntegratedLookupResult["officialPrice"],
  roadCondition: IntegratedLookupResult["roadCondition"],
): RegulationChecklist {
  const confirmed = [
    ...landUse.useAreas.map((item) => `${item} 확인됨`),
    ...landUse.useDistricts.map((item) => `${item} 확인됨`),
    ...landUse.useZones.map((item) => `${item} 확인됨`),
    ...(parcel.landCategory ? [`지목 ${parcel.landCategory} 확인 필요자료 확보`] : []),
    ...(parcel.areaSqm !== null ? [`대지면적 ${parcel.areaSqm}㎡ 속성값 확인`] : []),
    ...(officialPrice.value !== null ? [`공시지가 속성값 ${officialPrice.value.toLocaleString()} 확인됨`] : []),
    ...(roadCondition.status ? [`도로조건 ${roadCondition.status} 확인됨`] : []),
  ];

  const needsReview = [
    landUse.urbanFacilities.length === 0
      ? "도시계획시설 저촉 여부는 추가 검토 필요"
      : "도시계획시설 세부 저촉 여부는 추가 검토 필요",
    parcel.areaSqm === null
      ? "대지면적 공공 속성 연동은 추가 검토 필요"
      : "대지면적 산정 기준과 원장 대조 필요",
    parcel.landCategory === null
      ? "지목 확인을 위한 지적 속성 연동 추가 필요"
      : "지목과 실제 현황 일치 여부 추가 검토 필요",
    officialPrice.value === null
      ? "공시지가 연동은 추가 검토 필요"
      : "공시지가 기준시점과 최신성 검토 필요",
    roadCondition.status === null
      ? "도로조건 속성 연동은 추가 검토 필요"
      : "접도 폭원과 건축법상 도로 인정 여부 추가 검토 필요",
  ];

  const possibilities = [];

  if (landUse.useDistricts.length > 0) {
    possibilities.push("용도지구 기준 높이·경관·방재 제한 가능성 있음");
  }

  if (landUse.useZones.length > 0) {
    possibilities.push("용도구역 기준 행위 제한 또는 별도 협의 가능성 있음");
  }

  if (parcel.areaSqm !== null) {
    possibilities.push("대지면적 기준 건폐율·용적률 체크리스트 자동 생성 가능");
  }

  if (roadCondition.status) {
    possibilities.push("도로조건 기준 접도 및 진입 가능성 검토 자동화 가능");
  }

  if (officialPrice.value !== null) {
    possibilities.push("공시지가 기준 사업성 기초지표 연계 가능");
  }

  return {
    confirmed: uniqueStrings(confirmed),
    needsReview: uniqueStrings(needsReview),
    possibilities: uniqueStrings(possibilities),
  };
}

export async function geocodeAddress(input: string) {
  const normalized = normalizeAddress(input);

  if (!normalized) {
    throw new Error("대지위치를 입력해 주세요.");
  }

  const inferredType = inferAddressType(normalized);
  const primary = await geocodeByType(normalized, inferredType);

  try {
    return extractGeocodeResult(input, normalized, inferredType, primary);
  } catch {
    const fallbackType = inferredType === "ROAD" ? "PARCEL" : "ROAD";
    const fallback = await geocodeByType(normalized, fallbackType);
    return extractGeocodeResult(input, normalized, fallbackType, fallback);
  }
}

export async function fetchIntegratedLandLookup(geocode: GeocodeResult): Promise<IntegratedLookupResult> {
  const { x, y } = geocode.parsedAddress.point;
  const rawLayers: Record<string, unknown> = {};

  const landUse: IntegratedLandUse = {
    useAreas: [],
    useDistricts: [],
    useZones: [],
    urbanFacilities: [],
    districtPlans: [],
    notices: [],
    coordinate: { x, y },
  };

  await Promise.all(
    LAYER_CATALOG.map(async (layer) => {
      try {
        const rawLayer = await queryLayer(layer.typeName, x, y);
        rawLayers[layer.typeName] = rawLayer;

        const matches = pickFeatureLabels(rawLayer, layer.label);
        landUse[layer.category].push(...matches.map((match) => match.label));
        landUse.notices.push(
          ...matches
            .filter((match) => match.remark || match.ntfdate)
            .map((match) => ({
              title: match.label,
              announcedAt: match.ntfdate,
              description: match.remark,
            })),
        );
      } catch (error) {
        rawLayers[layer.typeName] = {
          error: error instanceof Error ? error.message : "레이어 조회 실패",
        };
      }
    }),
  );

  landUse.useAreas = uniqueStrings(landUse.useAreas);
  landUse.useDistricts = uniqueStrings(landUse.useDistricts);
  landUse.useZones = uniqueStrings(landUse.useZones);

  const propertySummary = collectLayerPropertySummary(rawLayers);
  landUse.urbanFacilities = propertySummary.urbanFacilities;
  landUse.districtPlans = propertySummary.districtPlans;

  const pnu = buildPnu(geocode);
  const parcel = buildParcelInfo(geocode, rawLayers);
  const officialPrice = {
    value: propertySummary.officialPriceCandidates[0] ?? null,
    source: propertySummary.officialPriceCandidates.length > 0 ? "공공 속성값" : null,
  };
  const roadCondition = {
    status: propertySummary.roadConditionCandidates[0] ?? null,
    source: propertySummary.roadConditionCandidates.length > 0 ? "공공 속성값" : null,
  };
  const regulationChecklist = buildRegulationChecklist(landUse, parcel, officialPrice, roadCondition);

  return {
    address: {
      input: geocode.input.original,
      normalized: geocode.input.normalized,
      roadAddress: geocode.parsedAddress.roadAddress,
      parcelAddress: geocode.parsedAddress.parcelAddress,
      displayAddress: geocode.parsedAddress.text,
      coordinate: geocode.parsedAddress.point,
    },
    pnu,
    parcel,
    landUse,
    officialPrice,
    roadCondition,
    regulationChecklist,
    raw: {
      geocode: geocode.raw,
      layers: rawLayers,
      extraction: propertySummary,
    },
  };
}
