"use client";

import { Scanner, useDeviceList } from "@yudiel/react-qr-scanner";
import React from "react";

import { JasupData, JasupWhere, WeekDayTime, getCurrentTime, koreanWhereTypeToEnglish } from "@/app/api/jasup/utils";
import { Outing } from "@/app/api/outing/utils";
import Insider from "@/provider/insider";
import { alert } from "@/utils/alert";
import instance from "@/utils/instance";


import Select from "../my/select";

type GetUser = {
  id: string;
  name: string;
  number: number;
  gender: string;
};

const Jasup = () => {
  const deviceList = useDeviceList();
  const [device, setDevice] = React.useState<MediaDeviceInfo>(deviceList[0]);
  const [leftright, setLeftRight] = React.useState(-1);
  const [loading, setLoading] = React.useState(false);
  const [number, setNumber] = React.useState("");
  const [where, setWhere] = React.useState<JasupWhere>("none");
  const [etc, setEtc] = React.useState<JasupData["etc"]>("");
  const [tmpOuting, setTmpOuting] = React.useState<Outing>({
    start: WeekDayTime[getCurrentTime()].start,
    end: WeekDayTime[getCurrentTime()].end,
    description: "",
  });
  const [selected, setSelected] = React.useState<GetUser | null>(null);
  const [set, setSet] = React.useState<boolean>(false);

  React.useEffect(() => {
    if(leftright === -1) {
      const data = localStorage.getItem("leftright");
      if(data) {
        const { leftright } = JSON.parse(data);
        setLeftRight(leftright);
      }
      return;
    }
    localStorage.setItem("leftright", JSON.stringify({
      leftright
    }));
  }, [leftright]);

  const findUser = async () => {
    setLoading(true);
    try{
      if(!number) return;
      const { data } = await instance.post("/api/jasup/getUser", {
        number: parseInt(number),
      });
      setSelected(data.data);
    }
    catch(e: any){
      alert.error(e.response.data.message);
      setNumber("");
    }
    setLoading(false);
  };
  React.useEffect(() => {
    if(number.length === 4) findUser();
    else setSelected(null);
  }, [number]);

  React.useEffect(() => {
    if(!selected) return;
    getJasupData();
  }, [selected?.id]);

  const getJasupData = async () => {
    setLoading(true);
    try{
      if(!selected) return;
      const { data } = await instance.post("/api/jasup/someone", {
        id: selected.id,
      });
      const type = data.data.type;
      const etc = data.data.etc;
      setWhere(type);
      setEtc(etc);
      if(type === "outing") setTmpOuting({
        start: etc.split("(")[1].split(")")[0].split("~")[0],
        end: etc.split("(")[1].split(")")[0].split("~")[1],
        description: etc.split("(")[0],
      });
    }
    catch(e: any){
      alert.error(e.response.data.message);
    }
    setLoading(false);
  };
  const putJasupData = async () => {
    setLoading(true);
    if(!selected) return;
    const loading = alert.loading("자습 위치 변경 중 입니다.");
    try{
      const res = await instance.put("/api/jasup/someone", {
        id: selected.id,
        type: where,
        etc: etc,
      });
      await getJasupData();
      alert.update(loading, res.data.message, "success");
    }
    catch(e: any){
      alert.update(loading, e.response.data.message, "error");
    }
    setLoading(false);
  };

  return (
    <div className="z-50 w-full h-full fixed bg-white top-0 left-0 flex flex-row items-center justify-center">
      {
        set ? (
          <Insider 
            className="w-full zoom"
          >
            <Select
              loading={loading}
              etc={etc}
              setEtc={setEtc}
              where={where}
              setWhere={setWhere}
              tmpOuting={tmpOuting}
              setTmpOuting={setTmpOuting}
              onButtonClick={() => {
                putJasupData();
                setSet(false);
                setNumber("");
              }}
              title={`${selected?.number} ${selected?.name} 자습 위치 설정하기`}
            />
          </Insider>
        ) : (
          <div className="flex flex-col items-center justify-center p-4 gap-2">
            <div className="flex flex-row items-center justify-center gap-4">
              <div 
                id="scanner"
                className="w-96 h-[656px] border border-text/20 rounded-md overflow-hidden transition-all"
                style={{
                  transform: leftright ? "scaleX(-1)" : "",
                }}
                onClick={() => setLeftRight(p => p === 0 ? 1 : 0)}
              >
                <Scanner
                  options={{
                    deviceId: device?.deviceId,
                  }}
                  styles={{
                    container: {
                      width: "100%",
                      height: "100%",
                    },
                    video: {
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    },
                  }}
                  onResult={(text, result) => setNumber(text)}
                />
              </div>
              <div className="flex flex-col gap-2 w-min">
                <div className={[
                  "border border-text/20 text-5xl rounded-md flex justify-center items-center h-28",
                  loading ? "loading_background" : "",
                ].join(" ")}>
                  {
                    selected ? `${selected.name} (${selected.gender === "male" ? "남" : "여"})` : number
                  }
                </div>
                {
                  [[1, 2, 3], [4, 5, 6], [7, 8, 9], ["C", 0, selected ? "확인" : "←"]].map((row, i) => (
                    <div key={i} className="flex flex-row gap-2">
                      {
                        row.map((e, j) => (
                          <button 
                            key={j}
                            onClick={() => {
                              if(e === "C") return setNumber("");
                              else if(e === "확인") return setSet(true);
                              else if(e === "←") return setNumber(p => p.slice(0, -1));
                              if(number.length >= 4) return;
                              setNumber(p => p + e);
                            }}
                            className={[
                              "w-28 h-32 flex items-center justify-center border border-text/20 text-5xl rounded-md cursor-pointer",
                              loading ? "loading_background" : "",
                            ].join(" ")}
                          >
                            {e}
                          </button>
                        ))
                      }
                    </div>
                  ))
                }
              </div>
            </div>
            <select 
              className="w-full px-2 text-text/40 border-0 bg-transparent"
              value={device?.deviceId}
              onChange={(e) => {
                const device = deviceList.find(device => device.deviceId === e.target.value);
                if(device) setDevice(device);
              }}
            >
              {
                deviceList.map((device, i) => (
                  <option key={i} value={device.deviceId}>{device.label}</option>
                ))
              }
            </select>
          </div>
        )
      }
    </div>
  );
};


export default Jasup;