#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
flight-ops ボード取得スクリプト（GitHub Actions 用・標準ライブラリのみ）

取得するもの（各空港公式サイトが公開している当日の運航データ）
  HND 羽田 : POST https://www.tokyo-haneda.com/app/api/v2/flight/search
  NRT 成田 : GET  https://www.narita-airport.jp/api/bff/searchFlight/
  FUK 福岡 : GET  https://www.fukuoka-airport.jp/api/flight_schedule/flight_schedule.json
出力: out/boards.json
個人情報は一切扱いません。
"""
import json
import os
import re
import sys
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
JST = timezone(timedelta(hours=9))
NOW = datetime.now(JST)
DATE = NOW.strftime("%Y-%m-%d")
STAMP = NOW.strftime("%Y-%m-%d %H:%M:%S")


def log(*a):
    print(*a, flush=True)


def jget(url, data=None, headers=None, timeout=30):
    h = {"User-Agent": UA, "Accept-Language": "ja,en;q=0.8"}
    h.update(headers or {})
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def hhmm(s):
    """'0735' / '2026-11-20 07:35:00' / '07:35' -> '07:35'"""
    if not s:
        return ""
    s = str(s)
    ms = re.findall(r"(\d{1,2}):(\d{2})", s)
    if ms:
        return "%02d:%s" % (int(ms[-1][0]), ms[-1][1])
    if re.fullmatch(r"\d{3,4}", s):
        s = s.zfill(4)
        return s[:2] + ":" + s[2:]
    return ""


# ---------------- 羽田 ----------------
def haneda():
    url = "https://www.tokyo-haneda.com/app/api/v2/flight/search"
    boards, as_of = {}, ""
    for key, ft, at in (("dom_dep", 1, 1), ("dom_arr", 1, 2), ("int_dep", 2, 1), ("int_arr", 2, 2)):
        body = {"flightType": ft, "arrivalType": at, "searchDt": DATE.replace("-", ""),
                "airportCodes": [], "airlineCodes": [], "flightNumber": "", "status": []}
        d = jget(url, body, {"Referer": "https://www.tokyo-haneda.com/flight/flightInfo_dms.html"})
        as_of = (d.get("date") or {}).get("display_date") or as_of
        rows = []
        for f in d.get("flightlists") or []:
            gate = ""
            for o in f.get("options") or []:
                if o.get("type") == "gate" and o.get("items"):
                    gate = "/".join(str(i.get("name")) for i in o["items"] if i.get("name"))
                    break
            nos = " ".join(str(a.get("flightNumber")) for a in f.get("airlines") or [] if a.get("flightNumber"))
            rows.append([hhmm(f.get("on_time")), hhmm(f.get("change_time")),
                         f.get("area_name") or "", f.get("area_name") or "", nos,
                         (f.get("terminal") or {}).get("terminal") or "", gate,
                         (f.get("status") or {}).get("text") or ""])
        boards[key] = rows
        log("HND %s: %d" % (key, len(rows)))
    return {"name": "羽田", "src": "羽田空港旅客ターミナル公式",
            "srcUrl": "https://www.tokyo-haneda.com/flight/flightInfo_dms.html",
            "asOf": as_of, "boards": boards}


# ---------------- 成田 ----------------
def narita():
    base = "https://www.narita-airport.jp/api/bff/searchFlight/"
    boards = {}
    for dom_inter in ("D", "I"):
        for dep_arr in ("D", "A"):
            key = ("dom" if dom_inter == "D" else "int") + ("_dep" if dep_arr == "D" else "_arr")
            rows = []
            for page in range(30):
                url = ("%s?locale=ja&domInter=%s&flightDepArr=%s&date=%s&page=%d&time=00%%3A00&size=100"
                       % (base, dom_inter, dep_arr, DATE, page))
                d = jget(url)
                fl = d.get("flights") or {}
                data = fl.get("data") or []
                for f in data:
                    ap = ((f.get("airport") or {}).get("original") or {})
                    rows.append([hhmm(f.get("scheduledTime")), hhmm(f.get("changeScheduledTime")),
                                 ap.get("3LetterCode") or "", ap.get("name") or "",
                                 f.get("displayFlightCode") or f.get("flightCode") or "",
                                 f.get("displayTerminal") or "",
                                 "/".join(g.get("gateNo") for g in (f.get("gate") or []) if g.get("gateNo")),
                                 ((f.get("status") or {}).get("status")) or ""])
                if not fl.get("hasNextPage") or not data:
                    break
            rows.sort(key=lambda r: r[0] or "")
            boards[key] = rows
            log("NRT %s: %d" % (key, len(rows)))
    return {"name": "成田", "src": "成田国際空港公式",
            "srcUrl": "https://www.narita-airport.jp/ja/flight/dep-search/",
            "asOf": "取得 %s" % STAMP[11:16], "boards": boards}


# ---------------- 福岡 ----------------
def fukuoka():
    d = jget("https://www.fukuoka-airport.jp/api/flight_schedule/flight_schedule.json", timeout=40)
    boards = {"dom_dep": [], "dom_arr": [], "int_dep": [], "int_arr": []}
    for f in d.values():
        if f.get("flt_ymd") != DATE:
            continue
        key = ("int" if f.get("intdom_div") == "I" else "dom") + ("_arr" if f.get("deparv_div") == "A" else "_dep")
        sched = hhmm(f.get("appointed_time"))
        changed = hhmm(f.get("true_ymdhm")) or hhmm(f.get("estimated_ymdhm"))
        if changed == sched:
            changed = ""
        nos = [str(f.get("airline_2cd") or "") + str(f.get("flt_num_no") or "").lstrip("0") + (f.get("flt_sfx") or "")]
        for s in f.get("share_airlines") or []:
            nos.append(str(s.get("airline_2cd") or "") + str(s.get("flt_num_no") or "").lstrip("0") + (s.get("flt_sfx") or ""))
        boards[key].append([sched, changed, f.get("tofrom_cd") or "", f.get("tofrom_name") or "",
                            " ".join(n for n in nos if n),
                            ("T" + str(f["ter_div"])) if (f.get("intdom_div") == "I" and f.get("ter_div")) else "",
                            f.get("wicket_num") or "", f.get("remarks") or ""])
    for k in boards:
        boards[k].sort(key=lambda r: r[0] or "")
        log("FUK %s: %d" % (k, len(boards[k])))
    return {"name": "福岡", "src": "福岡空港公式", "srcUrl": "https://www.fukuoka-airport.jp/flight/",
            "asOf": "取得 %s" % STAMP[11:16], "boards": boards}


LINK_ONLY = {
    "KIX": {"name": "関西", "srcUrl": "https://www.kansai-airport.or.jp/flight/"},
    "ITM": {"name": "伊丹", "srcUrl": "https://www.osaka-airport.co.jp/flight/"},
    "NGO": {"name": "中部", "srcUrl": "https://www.centrair.jp/flight/"},
    "CTS": {"name": "新千歳", "srcUrl": "https://www.hokkaido-airports.com/rd_newchitose/ja/flight/"},
    "OKA": {"name": "那覇", "srcUrl": "https://www.naha-airport.co.jp/flight/"},
    "TPE": {"name": "桃園", "srcUrl": "https://www.taoyuan-airport.com/flight_depart"},
    "ICN": {"name": "仁川", "srcUrl": "https://www.airport.kr/ap/en/dep/selectDepFlightList.do"},
}


def main():
    out = {"generatedAt": datetime.now(timezone.utc).isoformat(), "jst": STAMP, "date": DATE,
           "airports": {}, "failed": {}, "linkOnly": LINK_ONLY}
    jobs = {"HND": haneda, "NRT": narita, "FUK": fukuoka}
    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = {c: ex.submit(fn) for c, fn in jobs.items()}
        for c, fu in futs.items():
            try:
                r = fu.result()
                if r["boards"] and any(r["boards"].values()):
                    out["airports"][c] = r
                else:
                    out["failed"][c] = "empty"
            except Exception as e:
                out["failed"][c] = "%s: %s" % (type(e).__name__, str(e)[:180])
                log("ERROR %s: %s" % (c, e))
    os.makedirs("out", exist_ok=True)
    js = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    with open("out/boards.json", "w", encoding="utf-8") as f:
        f.write(js)
    counts = {k: sum(len(v) for v in a["boards"].values()) for k, a in out["airports"].items()}
    log("wrote out/boards.json %.0fKB %s failed=%s" % (len(js) / 1024, counts, out["failed"]))
    if not out["airports"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
