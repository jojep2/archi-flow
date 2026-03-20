import OpenAI from "openai";

type SummaryInput = {
  address: Record<string, unknown>;
  pnu: Record<string, unknown>;
  parcel: Record<string, unknown>;
  landUse: Record<string, unknown>;
  regulationChecklist: Record<string, unknown>;
  officialPrice?: Record<string, unknown>;
  roadCondition?: Record<string, unknown>;
};

let client: OpenAI | null = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

function buildFallbackSummary(payload: SummaryInput) {
  const parcel = payload.parcel as {
    landCategory?: string | null;
    areaSqm?: number | null;
  };
  const landUse = payload.landUse as {
    useAreas?: string[];
    useDistricts?: string[];
    useZones?: string[];
  };
  const officialPrice = payload.officialPrice as {
    value?: number | null;
  } | undefined;
  const roadCondition = payload.roadCondition as {
    status?: string | null;
  } | undefined;

  const areaText = parcel.areaSqm ? `${parcel.areaSqm}㎡` : "미확인";
  const useAreaText = landUse.useAreas && landUse.useAreas.length > 0 ? landUse.useAreas.join(", ") : "미확인";
  const useDistrictText = landUse.useDistricts && landUse.useDistricts.length > 0 ? landUse.useDistricts.join(", ") : "미확인";
  const useZoneText = landUse.useZones && landUse.useZones.length > 0 ? landUse.useZones.join(", ") : "미확인";
  const officialPriceText = officialPrice?.value ? `${officialPrice.value.toLocaleString()}` : "미연동";
  const roadConditionText = roadCondition?.status ?? "미연동";

  return [
    `지목은 ${parcel.landCategory ?? "미확인"}으로 조회되었고, 대지면적은 ${areaText}로 확인됨입니다.`,
    `용도지역은 ${useAreaText}, 용도지구는 ${useDistrictText}, 용도구역은 ${useZoneText}로 정리되었습니다.`,
    `공시지가 ${officialPriceText}, 도로조건 ${roadConditionText} 상태이며 최신 기준과 원장 대조는 추가 검토 필요합니다.`,
  ].join(" ");
}

export async function createLandUseSummary(payload: SummaryInput) {
  const openai = getClient();

  if (!openai) {
    return buildFallbackSummary(payload);
  }

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "당신은 한국 건축 실무자를 돕는 토지·법규 검토 보조자다.",
              "반드시 한국어로만 3~5문장으로 요약한다.",
              "법적 확정판단처럼 단정하지 말고, '확인됨', '추가 검토 필요', '가능성 있음' 같은 실무형 표현을 사용한다.",
              "PNU, 지목, 대지면적, 용도지역, 용도지구, 용도구역, 도시계획시설, 공시지가, 도로조건 여부를 우선 반영한다.",
              "정보가 비어 있으면 그 사실과 추가 연동 필요 여부를 함께 언급한다.",
              "출력은 순수 텍스트만 반환한다.",
            ].join(" "),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      },
    ],
  });

  return response.output_text.trim();
}
