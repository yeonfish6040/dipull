import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { connectToDatabase } from "@/utils/db";
import { verify } from "@/utils/jwt";

import { JasupData, getCurrentTime, getToday } from "../utils";

const PUT = async (
  req: Request,
) => {
  // 헤더 설정
  const new_headers = new Headers();
  new_headers.append("Content-Type", "application/json; charset=utf-8");
  
  // Authorization 헤더 확인
  const authorization = headers().get("authorization");
  const verified = await verify(authorization?.split(" ")[1] || "");
  if(!verified.ok || !verified.payload?.id) return new NextResponse(JSON.stringify({
    message: "로그인이 필요합니다.",
  }), {
    status: 401,
    headers: new_headers
  });

  const { type, etc }: {
    type: JasupData["type"];
    etc: JasupData["etc"];
  } = await req.json();

  if(!type) return new NextResponse(JSON.stringify({
    message: "위치를 선택해주세요.",
  }), {
    status: 400,
    headers: new_headers
  });
  if(!etc && (type === "etcroom" || type === "outing" || type === "afterschool")) return new NextResponse(JSON.stringify({
    message: "자세한 위치를 입력해주세요.",
  }), {
    status: 400,
    headers: new_headers
  });

  const today = getToday().format("YYYY-MM-DD");
  const current = getCurrentTime();
  const number = verified.payload.data.number;
  const data: JasupData = {
    id: verified.payload.id,
    gradeClass: Math.floor(number / 100),
    date: today,
    time: current,
    type,
    etc,
  };
  const client = await connectToDatabase();
  const jasupCollection = client.db().collection("jasup");

  if(type === "none") {
    const remove = await jasupCollection.deleteOne({
      id: data.id,
      date: data.date,
      time: data.time,
    });
    if(remove.deletedCount) {
      return new NextResponse(JSON.stringify({
        message: "성공적으로 위치를 변경했습니다.",
        ok: true,
      }), {
        status: 200,
        headers: new_headers
      });
    }
    else {
      return new NextResponse(JSON.stringify({
        message: "이미 미입실한 상태입니다. (예약 목록을 확인해주세요)",
        ok: false,
      }), {
        status: 500,
        headers: new_headers
      });
    }
  }

  const put = await jasupCollection.updateOne({
    id: data.id,
    date: data.date,
    time: data.time,
  }, {
    $set: data,
  }, {
    upsert: true,
  });

  if(put) {
    return new NextResponse(JSON.stringify({
      message: "성공적으로 위치를 변경했습니다.",
      ok: true,
    }), {
      status: 200,
      headers: new_headers
    });
  }
  else {
    return new NextResponse(JSON.stringify({
      message: "오류가 발생했습니다.",
      ok: false,
    }), {
      status: 500,
      headers: new_headers
    });
  }

};

export default PUT;