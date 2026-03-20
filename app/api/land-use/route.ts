import { NextRequest, NextResponse } from "next/server";
import { saveLandUseLookupHistory } from "@/lib/firestore";
import { createLandUseSummary } from "@/lib/openai";
import { fetchIntegratedLandLookup, geocodeAddress } from "@/lib/vworld";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { address?: string };
    const inputAddress = body.address?.trim() ?? "";

    if (!inputAddress) {
      return NextResponse.json(
        {
          success: false,
          message: "대지위치를 입력해 주세요.",
        },
        { status: 400 },
      );
    }

    const geocode = await geocodeAddress(inputAddress);
    const integrated = await fetchIntegratedLandLookup(geocode);
    const aiSummary = await createLandUseSummary({
      address: integrated.address,
      pnu: integrated.pnu,
      parcel: integrated.parcel,
      landUse: integrated.landUse,
      regulationChecklist: integrated.regulationChecklist,
      officialPrice: integrated.officialPrice,
      roadCondition: integrated.roadCondition,
    });

    const responsePayload = {
      success: true,
      address: integrated.address,
      pnu: integrated.pnu,
      parcel: integrated.parcel,
      landUse: integrated.landUse,
      officialPrice: integrated.officialPrice,
      roadCondition: integrated.roadCondition,
      regulationChecklist: integrated.regulationChecklist,
      aiSummary,
      raw: integrated.raw,
    };

    let firestoreSaved = true;
    let firestoreError: string | null = null;

    try {
      await saveLandUseLookupHistory({
        inputAddress,
        landUse: {
          address: responsePayload.address,
          pnu: responsePayload.pnu,
          parcel: responsePayload.parcel,
          landUse: responsePayload.landUse,
          officialPrice: responsePayload.officialPrice,
          roadCondition: responsePayload.roadCondition,
          regulationChecklist: responsePayload.regulationChecklist,
        },
        aiSummary,
        raw: responsePayload.raw,
      });
    } catch (error) {
      firestoreSaved = false;
      firestoreError = error instanceof Error
        ? error.message
        : "Firestore 저장 중 알 수 없는 오류가 발생했습니다.";
    }

    return NextResponse.json({
      ...responsePayload,
      raw: {
        ...responsePayload.raw,
        persistence: {
          firestoreSaved,
          firestoreError,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "토지이용계획 조회 중 오류가 발생했습니다.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 },
    );
  }
}
