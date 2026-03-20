"use client";

import { useState } from "react";

type LookupResponse = {
  success: boolean;
  message?: string;
  address?: {
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
  pnu?: {
    fullPnu: string | null;
    legalDongCode: string | null;
    parcelKey: string | null;
    resolved: boolean;
    unresolvedReason: string | null;
  };
  parcel?: {
    parcelAddress: string | null;
    lotNumber: string | null;
    landCategory: string | null;
    areaSqm: number | null;
    areaSource: string | null;
  };
  landUse?: {
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
  };
  officialPrice?: {
    value: number | null;
    source: string | null;
  };
  roadCondition?: {
    status: string | null;
    source: string | null;
  };
  regulationChecklist?: {
    confirmed: string[];
    needsReview: string[];
    possibilities: string[];
  };
  aiSummary?: string | null;
  raw?: Record<string, unknown>;
};

const SAMPLE_ADDRESSES = [
  "서울특별시 강남구 삼성동 159-1",
  "대구광역시 북구 산격동 123-45",
  "부산광역시 해운대구 우동 1410-1",
];

function SectionList({ title, items }: { title: string; items?: string[] }) {
  return (
    <section className="result-card list-card">
      <div className="section-top">
        <h3>{title}</h3>
        <span>{items?.length ?? 0}건</span>
      </div>
      {!items || items.length === 0 ? (
        <p className="empty-text">조회된 항목 없음</p>
      ) : (
        <ul className="result-list compact-list">
          {items.map((item) => (
            <li key={`${title}-${item}`}>
              <strong>{item}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MetaCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article>
      <small>{title}</small>
      <strong>{value}</strong>
      <p>{description}</p>
    </article>
  );
}

export default function Page() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [error, setError] = useState("");

  const handleLookup = async () => {
    if (!address.trim()) {
      setError("주소 또는 지번을 입력해 주세요.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/land-use", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      });

      const data = (await res.json()) as LookupResponse;

      if (!res.ok || !data.success) {
        throw new Error(data.message || "조회 중 오류가 발생했습니다.");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-shell">
      <section className="hero-shell">
        <div className="hero-copy">
          <p className="hero-badge">PNU 기반 법규검토 MVP</p>
          <h1>PNU를 중심으로 필지정보와 토지이용계획을 묶어 조회합니다.</h1>
          <p className="hero-desc">
            주소를 입력하면 주소 정제, PNU 후보 생성, 지목, 대지면적, 토지이용계획, 공시지가, 도로조건, 법규검토 체크리스트를 한 화면에 정리합니다.
          </p>

          <div className="search-panel">
            <label htmlFor="address" className="search-label">
              대지위치 입력
            </label>
            <div className="search-row">
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="예: 서울특별시 강남구 삼성동 159-1"
                className="search-input"
              />
              <button
                onClick={handleLookup}
                disabled={loading || !address.trim()}
                className="search-button"
              >
                {loading ? "조회 중..." : "조회"}
              </button>
            </div>
            <div className="sample-row">
              {SAMPLE_ADDRESSES.map((sample) => (
                <button key={sample} type="button" className="sample-chip" onClick={() => setAddress(sample)}>
                  {sample}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="error-box">
              <strong>오류</strong>
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="hero-side">
          <div className="stat-card">
            <span>조회 흐름</span>
            <strong>주소 → PNU → 필지정보 → 토지이용계획</strong>
            <p>PNU를 기준으로 지목, 면적, 공시지가, 도로조건까지 이어 붙이는 구조를 기준으로 설계했습니다.</p>
          </div>
          <div className="stat-card accent">
            <span>출력 구조</span>
            <strong>parcel · landUse · extra · checklist</strong>
            <p>향후 법규 체크리스트와 자동 판정 로직을 이어 붙이기 쉬운 JSON 분리 구조를 유지합니다.</p>
          </div>
        </div>
      </section>

      {result && (
        <section className="results-grid">
          <div className="results-main">
            <section className="result-card summary-card">
              <div className="section-top">
                <h2>조회 요약</h2>
                <span>{result.address?.displayAddress || "조회 완료"}</span>
              </div>
              <div className="summary-grid four-grid">
                <MetaCard title="PNU" value={result.pnu?.fullPnu || "생성 실패"} description={result.pnu?.resolved ? "19자리 PNU 생성됨" : result.pnu?.unresolvedReason || "추가 검토 필요"} />
                <MetaCard title="지목" value={result.parcel?.landCategory || "미연동"} description={result.parcel?.lotNumber || "필지번호 미확인"} />
                <MetaCard title="대지면적" value={result.parcel?.areaSqm !== null && result.parcel?.areaSqm !== undefined ? `${result.parcel.areaSqm}㎡` : "미연동"} description={result.parcel?.areaSource || "공공 속성값 미확보"} />
                <MetaCard title="공시지가" value={result.officialPrice?.value !== null && result.officialPrice?.value !== undefined ? `${result.officialPrice.value.toLocaleString()}` : "미연동"} description={result.officialPrice?.source || "추가 연동 필요"} />
              </div>
            </section>

            <section className="result-card list-card">
              <div className="section-top">
                <h3>필지 기본정보</h3>
                <span>{result.pnu?.resolved ? "PNU 생성됨" : "PNU 후보만 확보"}</span>
              </div>
              <ul className="result-list">
                <li><strong>입력주소</strong><span>{result.address?.input || "-"}</span></li>
                <li><strong>정제주소</strong><span>{result.address?.displayAddress || "-"}</span></li>
                <li><strong>지번주소</strong><span>{result.parcel?.parcelAddress || result.address?.parcelAddress || "-"}</span></li>
                <li><strong>필지번호</strong><span>{result.parcel?.lotNumber || result.pnu?.parcelKey || "-"}</span></li>
                <li><strong>법정동코드</strong><span>{result.pnu?.legalDongCode || "미확보"}</span></li>
                <li><strong>PNU 상태</strong><span>{result.pnu?.resolved ? "완성" : result.pnu?.unresolvedReason || "추가 검토 필요"}</span></li>
                <li><strong>도로조건</strong><span>{result.roadCondition?.status || "미연동"}</span></li>
              </ul>
            </section>

            <SectionList title="용도지역" items={result.landUse?.useAreas} />
            <SectionList title="용도지구" items={result.landUse?.useDistricts} />
            <SectionList title="용도구역" items={result.landUse?.useZones} />
            <SectionList title="도시계획시설" items={result.landUse?.urbanFacilities} />
            <SectionList title="지구단위계획" items={result.landUse?.districtPlans} />

            <section className="result-card list-card">
              <div className="section-top">
                <h3>고시정보</h3>
                <span>{result.landUse?.notices?.length ?? 0}건</span>
              </div>
              {!result.landUse?.notices || result.landUse.notices.length === 0 ? (
                <p className="empty-text">조회된 항목 없음</p>
              ) : (
                <ul className="result-list">
                  {result.landUse.notices.map((notice, index) => (
                    <li key={`${notice.title}-${index}`}>
                      <strong>{notice.title}</strong>
                      <span>{notice.announcedAt || "고시일 미확인"}</span>
                      <p>{notice.description || "고시 설명 미확인"}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="results-side">
            <section className="result-card ai-card">
              <div className="section-top">
                <h2>AI 해설</h2>
                <span>실무형 요약</span>
              </div>
              <p>{result.aiSummary || "AI 해설이 없습니다."}</p>
            </section>

            <section className="result-card list-card">
              <div className="section-top">
                <h3>추가 지표</h3>
                <span>PNU 연계 결과</span>
              </div>
              <ul className="result-list">
                <li><strong>공시지가</strong><span>{result.officialPrice?.value !== null && result.officialPrice?.value !== undefined ? `${result.officialPrice.value.toLocaleString()}` : "미연동"}</span></li>
                <li><strong>공시지가 출처</strong><span>{result.officialPrice?.source || "추가 연동 필요"}</span></li>
                <li><strong>도로조건</strong><span>{result.roadCondition?.status || "미연동"}</span></li>
                <li><strong>도로조건 출처</strong><span>{result.roadCondition?.source || "추가 연동 필요"}</span></li>
              </ul>
            </section>

            <section className="result-card list-card">
              <div className="section-top">
                <h3>법규검토 체크리스트</h3>
                <span>자동 생성 기반</span>
              </div>
              <ul className="result-list">
                {(result.regulationChecklist?.confirmed || []).map((item) => (
                  <li key={`confirmed-${item}`}><strong>확인됨</strong><span>{item}</span></li>
                ))}
                {(result.regulationChecklist?.needsReview || []).map((item) => (
                  <li key={`review-${item}`}><strong>추가 검토 필요</strong><span>{item}</span></li>
                ))}
                {(result.regulationChecklist?.possibilities || []).map((item) => (
                  <li key={`possible-${item}`}><strong>가능성 있음</strong><span>{item}</span></li>
                ))}
              </ul>
            </section>

            <details className="result-card raw-card">
              <summary>원본 JSON 보기</summary>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </details>
          </aside>
        </section>
      )}

      <style jsx>{`
        .page-shell {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(209, 213, 219, 0.45), transparent 24%),
            linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
          padding: 32px 20px 64px;
          color: #0f172a;
        }

        .hero-shell {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) 340px;
          gap: 20px;
          align-items: stretch;
        }

        .hero-copy,
        .hero-side,
        .result-card {
          border-radius: 28px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(255, 255, 255, 0.82);
          backdrop-filter: blur(16px);
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
        }

        .hero-copy {
          padding: 36px;
        }

        .hero-badge {
          display: inline-flex;
          margin: 0 0 14px;
          padding: 8px 12px;
          border-radius: 999px;
          background: #dbeafe;
          color: #1d4ed8;
          font-size: 13px;
          font-weight: 700;
        }

        h1 {
          margin: 0;
          font-size: clamp(2.2rem, 5vw, 4.2rem);
          line-height: 1.06;
          letter-spacing: -0.05em;
        }

        .hero-desc {
          margin: 16px 0 0;
          max-width: 640px;
          color: #475569;
          font-size: 1.05rem;
          line-height: 1.7;
        }

        .search-panel {
          margin-top: 28px;
          padding: 18px;
          border-radius: 22px;
          background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92));
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .search-label {
          display: block;
          margin-bottom: 12px;
          font-size: 0.95rem;
          font-weight: 700;
          color: #334155;
        }

        .search-row {
          display: grid;
          grid-template-columns: 1fr 132px;
          gap: 12px;
        }

        .search-input {
          width: 100%;
          height: 60px;
          border: 1px solid #cbd5e1;
          border-radius: 18px;
          padding: 0 18px;
          font-size: 1rem;
          outline: none;
        }

        .search-button {
          height: 60px;
          border: 0;
          border-radius: 18px;
          background: linear-gradient(135deg, #0f172a, #334155);
          color: white;
          font-size: 1rem;
          font-weight: 800;
        }

        .search-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .sample-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .sample-chip {
          border: 1px solid #dbeafe;
          background: #eff6ff;
          color: #1e40af;
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 0.9rem;
        }

        .error-box {
          margin-top: 16px;
          padding: 16px 18px;
          border-radius: 18px;
          background: #fef2f2;
          border: 1px solid #fecaca;
        }

        .error-box strong {
          display: block;
          margin-bottom: 6px;
          color: #b91c1c;
        }

        .error-box p {
          margin: 0;
          color: #7f1d1d;
        }

        .hero-side {
          display: grid;
          gap: 20px;
          padding: 20px;
        }

        .stat-card {
          border-radius: 22px;
          background: #0f172a;
          color: white;
          padding: 22px;
        }

        .stat-card.accent {
          background: linear-gradient(135deg, #1d4ed8, #0f766e);
        }

        .stat-card span {
          display: block;
          font-size: 0.84rem;
          opacity: 0.7;
          margin-bottom: 10px;
        }

        .stat-card strong {
          display: block;
          font-size: 1.35rem;
          line-height: 1.35;
          margin-bottom: 10px;
        }

        .stat-card p {
          margin: 0;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.6;
        }

        .results-grid {
          max-width: 1180px;
          margin: 22px auto 0;
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) 340px;
          gap: 20px;
        }

        .results-main,
        .results-side {
          display: grid;
          gap: 16px;
        }

        .result-card {
          padding: 22px;
        }

        .section-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
        }

        .section-top h2,
        .section-top h3 {
          margin: 0;
          font-size: 1.08rem;
          letter-spacing: -0.03em;
        }

        .section-top span {
          color: #64748b;
          font-size: 0.92rem;
        }

        .summary-grid {
          display: grid;
          gap: 12px;
        }

        .four-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .summary-grid article,
        .result-list li {
          padding: 16px;
          border-radius: 18px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .summary-grid small {
          display: block;
          color: #64748b;
          margin-bottom: 6px;
        }

        .summary-grid p,
        .result-list p {
          margin: 6px 0 0;
          color: #64748b;
          line-height: 1.5;
          font-size: 0.92rem;
        }

        .result-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 10px;
        }

        .compact-list li strong {
          margin-bottom: 0;
        }

        .result-list strong {
          display: block;
          margin-bottom: 4px;
        }

        .result-list span,
        .empty-text,
        .ai-card p {
          color: #475569;
          line-height: 1.7;
        }

        .raw-card summary {
          cursor: pointer;
          font-weight: 800;
        }

        .raw-card pre {
          margin: 16px 0 0;
          padding: 16px;
          border-radius: 16px;
          background: #0f172a;
          color: #e2e8f0;
          overflow-x: auto;
          font-size: 13px;
        }

        @media (max-width: 980px) {
          .hero-shell,
          .results-grid {
            grid-template-columns: 1fr;
          }

          .hero-side,
          .four-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 640px) {
          .page-shell {
            padding: 18px 14px 40px;
          }

          .hero-copy,
          .hero-side,
          .result-card {
            border-radius: 22px;
            padding: 18px;
          }

          .search-row,
          .hero-side,
          .four-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
