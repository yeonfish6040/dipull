import axios from "axios";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { YouTubeSearchResults } from "youtube-search";

import { getApplyStartDate } from "@/app/api/stay/utils";
import { connectToDatabase } from "@/utils/db";
import { verify } from "@/utils/jwt";


import { WakeupData, getToday } from "./utils";

const PUT = async (
  req: Request,
) => {
  // 헤더 설정
  const new_headers = new Headers();
  new_headers.append("Content-Type", "application/json; charset=utf-8");

  // Authorization 헤더 확인
  const authorization = headers().get("authorization");
  const accessToken = authorization?.split(" ")[1] || "";
  const verified = await verify(accessToken);
  if(!verified.ok || !verified.payload?.id || !verified.payload?.data.id) return new NextResponse(JSON.stringify({
    message: "로그인이 필요합니다.",
  }), {
    status: 401,
    headers: new_headers
  });

  const json = await req.json();
  const select: YouTubeSearchResults = json.data;
  if(!select.id) return new NextResponse(JSON.stringify({
    message: "페이로드 불일치.",
  }), {
    status: 400,
    headers: new_headers
  });

  const today = getToday();
  const client = await connectToDatabase();
  const wakeupCollection = client.db().collection("wakeup");

  const mySelect = await wakeupCollection.find({
    owner: verified.payload.data.id,
    date: today.format("YYYY-MM-DD"),
    gender: verified.payload.data.gender,
  }).toArray();
  if(mySelect.length >= 3) return new NextResponse(JSON.stringify({
    message: "하루에 3곡까지만 추가할 수 있습니다.",
    ok: false,
  }), {
    status: 400,
    headers: new_headers
  });

  try {
    const url = "https://www.youtube.com/oembed";
    const params = { "format": "json", "url": `https://www.youtube.com/watch?v=${select.id}` };
    const res = await axios.get(url, {
      params,
    });

    const putData: WakeupData = {
      title: res.data.title,
      id: select.id,
      owner: verified.payload.data.id,
      date: today.format("YYYY-MM-DD"),
      gender: verified.payload.data.gender,
      week: await getApplyStartDate(),
    };
    const add = await wakeupCollection.insertOne(putData);

    const mySelect = await wakeupCollection.find({
      owner: verified.payload.data.id,
      date: today.format("YYYY-MM-DD"),
      gender: verified.payload.data.gender,
    }).toArray();
    if (mySelect.length > 3) {
      await wakeupCollection.deleteOne({
        _id: add.insertedId,
      });
      return new NextResponse(JSON.stringify({
        message: "하루에 3곡까지만 추가할 수 있습니다.",
        ok: false,
      }), {
        status: 400,
        headers: new_headers
      });
    }
    else if(add) {
      return new NextResponse(JSON.stringify({
        message: "성공적으로 추가되었습니다.",
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
  }
  catch (e: any) {
    if (e.response.data.type !== "video") return new NextResponse(JSON.stringify({
      message: "동영상만 추가할 수 있습니다.",
      ok: false,
    }), {
      status: 400,
      headers: new_headers
    });
    return new NextResponse(JSON.stringify({
      message: e.message,
      ok: false,
    }), {
      status: 500,
      headers: new_headers
    });
  }
};

export default PUT;