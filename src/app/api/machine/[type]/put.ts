import "moment-timezone";
import axios from "axios";
import moment from "moment";
import { ObjectId } from "mongodb";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { connectToDatabase } from "@/utils/db";
import { verify } from "@/utils/jwt";

import { sendMachineNotification } from "./server";
import { MachineDB, Params, getApplyEndTime, getApplyStartTime, getDefaultValue } from "./utils";

const PUT = async (
  req: Request,
  { params }: { params: Params }
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

  const currentTime = moment(moment().tz("Asia/Seoul").format("HH:mm"), "HH:mm");
  const applyStartDate = moment(await getApplyStartTime(), "HH:mm");
  const applyEndDate = moment(await getApplyEndTime(), "HH:mm");
  if(currentTime.isBefore(applyStartDate) || currentTime.isAfter(applyEndDate)) {
    return new NextResponse(JSON.stringify({
      success: false,
      message: `${applyStartDate.format("HH시 mm분")}부터 ${applyEndDate.format("HH시 mm분")} 사이에 신청 가능합니다.`,
    }), {
      status: 400,
      headers: new_headers
    });
  }

  const { machine, time, captcha_string, captcha_id } = await req.json();
  if (!machine || !time) return new NextResponse(JSON.stringify({
    success: false,
    message: "빈칸을 모두 채워주세요.",
  }), {
    status: 400,
    headers: new_headers
  });
  if (!captcha_string || !captcha_id) return new NextResponse(JSON.stringify({
    success: false,
    message: "로봇이 아님을 증명해주세요.",
  }), {
    status: 400,
    headers: new_headers
  });

  const client = await connectToDatabase();
  const captchaCollection = client.db().collection("captcha");
  const captcha = await captchaCollection.findOne({ _id: ObjectId.createFromHexString(captcha_id) });
  if (
    !captcha
    || captcha_string !== captcha.number
  ) {
    await captchaCollection.deleteOne({ _id: ObjectId.createFromHexString(captcha_id) });
    return new NextResponse(JSON.stringify({
      success: false,
      message: "올바르지 않은 자동 입력 방지 문자입니다.",
    }), {
      status: 400,
      headers: new_headers
    });
  }
  if (moment().tz("Asia/Seoul").isAfter(moment(captcha.until))) {
    await captchaCollection.deleteOne({ _id: ObjectId.createFromHexString(captcha_id) });
    return new NextResponse(JSON.stringify({
      success: false,
      message: "입력 가능한 시간이 지났습니다.",
    }), {
      status: 400,
      headers: new_headers
    });
  }
  await captchaCollection.deleteOne({ _id: ObjectId.createFromHexString(captcha_id) });

  const isStay = moment().tz("Asia/Seoul").day() === 0 || moment().tz("Asia/Seoul").day() === 6;
  const defaultData = await getDefaultValue(params.type, isStay);

  if(verified.payload.data.gender !== defaultData[machine].allow.gender)
    return new NextResponse(JSON.stringify({
      success: false,
      message: "성별이 맞지 않습니다.",
    }), {
      status: 400,
      headers: new_headers
    });

  if(!defaultData[machine].allow.grades.includes(Math.floor(verified.payload.data.number / 1000)))
    return new NextResponse(JSON.stringify({
      success: false,
      message: "학년이 맞지 않습니다.",
    }), {
      status: 400,
      headers: new_headers
    });

  const machineCollection = client.db().collection("machine");

  const isIBookedQuery = { type: params.type, date: moment().tz("Asia/Seoul").format("YYYY-MM-DD"), owner: verified.payload.data.id };
  const isIBooked = await machineCollection.findOne(isIBookedQuery);
  if(isIBooked) return new NextResponse(JSON.stringify({
    success: false,
    message: "이미 예약한 시간이 있습니다.",
  }), {
    status: 400,
    headers: new_headers
  });

  const query = { type: params.type, machine, time, date: moment().tz("Asia/Seoul").format("YYYY-MM-DD") };
  const result = await machineCollection.findOne(query);
  if(result) return new NextResponse(JSON.stringify({
    success: false,
    message: "이미 예약된 시간입니다.",
  }), {
    status: 400,
    headers: new_headers
  });

  const put_query: MachineDB = {
    machine,
    time,
    date: moment().tz("Asia/Seoul").format("YYYY-MM-DD"),
    owner: verified.payload.data.id,
    type: params.type,
  };
  const put = await machineCollection.insertOne(put_query);

  await sendMachineNotification(params.type, machine, time, verified.payload.data.id);

  if(!put.acknowledged) return new NextResponse(JSON.stringify({
    success: false,
    message: "예약에 실패했습니다.",
  }), {
    status: 500,
    headers: new_headers
  });

  return new NextResponse(JSON.stringify({
    success: true,
    message: "예약에 성공했습니다.",
    ret: {
      start: applyStartDate.format("HH:mm"),
      end: applyEndDate.format("HH:mm"),
      currentTime: currentTime.format("HH:mm"),
      ifBefore: currentTime.isBefore(applyStartDate),
      ifAfter: currentTime.isAfter(applyEndDate),
    }
  }), {
    status: 200,
    headers: new_headers
  });
};

export default PUT;