/* ============================================================
   FLIGHT OPS  空港リンクデータ (links_data.js)
   ------------------------------------------------------------
   形式: [IATA, 日本語名, 公式フライト情報URL(未確認は""), ICAO(空港コード)]
   ・Flightradar24 出発/到着: https://www.flightradar24.com/data/airports/{iata}/departures|arrivals
   ・FlightAware 空港:        https://www.flightaware.com/live/airport/{ICAO}
   公式URLは 2026-11-20 に HTTP 応答を確認（403 のものはボット遮断で、ブラウザでは閲覧可）。
   ============================================================ */
window.FO_AIRPORT_LINKS = [
  // 日本
  ["HND", "羽田", "https://www.tokyo-haneda.com/flight/flightInfo_dms.html", "RJTT"],
  ["NRT", "成田", "https://www.narita-airport.jp/ja/flight/dep-search/", "RJAA"],
  ["KIX", "関西", "https://www.kansai-airport.or.jp/flight/", "RJBB"],
  ["ITM", "伊丹", "https://www.osaka-airport.co.jp/flight/", "RJOO"],
  ["FUK", "福岡", "https://www.fukuoka-airport.jp/flight/", "RJFF"],
  ["CTS", "新千歳", "https://www.hokkaido-airports.com/ja/new-chitose/", "RJCC"],
  ["OKA", "那覇", "https://www.naha-airport.co.jp/flight/", "ROAH"],
  ["NGO", "中部", "https://www.centrair.jp/flight/", "RJGG"],
  ["SDJ", "仙台", "https://www.sendai-airport.co.jp/flight/", "RJSS"],
  ["OKJ", "岡山", "https://www.okayama-airport.org/flight", "RJOB"],
  ["HIJ", "広島", "", "RJOA"],
  ["KOJ", "鹿児島", "", "RJFK"],
  ["KMJ", "熊本", "", "RJFT"],
  ["MYJ", "松山", "", "RJOM"],
  ["TAK", "高松", "", "RJOT"],
  ["FSZ", "静岡", "", "RJNS"],
  ["KMQ", "小松", "", "RJNK"],
  ["KIJ", "新潟", "", "RJSN"],
  ["AXT", "秋田", "", "RJSK"],
  ["HNA", "花巻", "", "RJSI"],
  ["IBR", "茨城", "", "RJAH"],
  ["IZO", "出雲", "", "RJOC"],
  ["ISG", "石垣", "", "ROIG"],
  ["MMY", "宮古", "", "ROMY"],
  ["SHI", "下地島", "", "RORS"],
  ["ASJ", "奄美", "", "RJKA"],
  ["TKN", "徳之島", "", "RJTK"],
  ["KMI", "宮崎", "", "RJFM"],
  ["NGS", "長崎", "", "RJFU"],
  ["OIT", "大分", "", "RJFO"],
  ["YGJ", "米子", "", "RJOH"],
  ["TTJ", "鳥取", "", "RJOR"],
  ["IWK", "岩国", "", "RJOI"],
  ["AOJ", "青森", "", "RJSA"],
  ["FKS", "福島", "", "RJSF"],
  ["MMJ", "松本", "", "RJAF"],
  ["TOY", "富山", "", "RJNT"],
  ["NKM", "小牧", "", "RJNA"],
  // 韓国・台湾・香港・中国
  ["ICN", "仁川", "https://www.airport.kr/ap/en/dep/selectDepFlightList.do", "RKSI"],
  ["GMP", "金浦", "https://www.airport.kr/ap/en/dep/selectDepFlightList.do", "RKSS"],
  ["PUS", "釜山", "https://www.airport.kr/ap/en/dep/selectDepFlightList.do", "RKPK"],
  ["CJU", "済州", "https://www.airport.co.kr/jeju/", "RKPC"],
  ["TAE", "大邱", "", "RKTN"],
  ["CJJ", "清州", "", "RKTU"],
  ["TPE", "桃園", "https://www.taoyuan-airport.com/flight_depart", "RCTP"],
  ["KHH", "高雄", "", "RCKH"],
  ["HKG", "香港", "https://www.hongkongairport.com/en/flights/departures", "VHHH"],
  ["MFM", "マカオ", "", "VMMC"],
  ["PVG", "上海浦東", "", "ZSPD"],
  ["SHA", "上海虹橋", "", "ZSSS"],
  ["PEK", "北京首都", "", "ZBAA"],
  ["PKX", "北京大興", "", "ZBAD"],
  ["CAN", "広州", "", "ZGGG"],
  ["SZX", "深圳", "", "ZGSZ"],
  // 東南アジア・南アジア
  ["SIN", "シンガポール", "https://www.changiairport.com/en/fly/flight-information/departures.html", "WSSS"],
  ["BKK", "バンコク", "https://www.suvarnabhumiairport.com/en/departure", "VTBS"],
  ["DMK", "ドンムアン", "", "VTBD"],
  ["KUL", "クアラルンプール", "", "WMKK"],
  ["SGN", "ホーチミン", "", "VVTS"],
  ["HAN", "ハノイ", "", "VVNB"],
  ["DAD", "ダナン", "", "VVDN"],
  ["MNL", "マニラ", "https://www.miaa.gov.ph/", "RPLL"],
  ["CEB", "セブ", "", "RPVM"],
  ["CGK", "ジャカルタ", "", "WIII"],
  ["DPS", "バリ", "", "WADD"],
  ["DEL", "デリー", "https://www.newdelhiairport.in/", "VIDP"],
  // 北米・ハワイ・グアム
  ["LAX", "ロサンゼルス", "", "KLAX"],
  ["SFO", "サンフランシスコ", "", "KSFO"],
  ["SEA", "シアトル", "", "KSEA"],
  ["JFK", "ニューヨーク JFK", "", "KJFK"],
  ["ORD", "シカゴ", "", "KORD"],
  ["DFW", "ダラス", "", "KDFW"],
  ["YVR", "バンクーバー", "", "CYVR"],
  ["HNL", "ホノルル", "", "PHNL"],
  ["GUM", "グアム", "https://www.guamairport.com/", "PGUM"],
  // ヨーロッパ・中東・オセアニア
  ["LHR", "ロンドン ヒースロー", "https://www.heathrow.com/arrivals", "EGLL"],
  ["CDG", "パリ CDG", "https://www.parisaeroport.fr/en/passengers/flights", "LFPG"],
  ["FRA", "フランクフルト", "", "EDDF"],
  ["MUC", "ミュンヘン", "", "EDDM"],
  ["AMS", "アムステルダム", "", "EHAM"],
  ["HEL", "ヘルシンキ", "", "EFHK"],
  ["IST", "イスタンブール", "", "LTFM"],
  ["DXB", "ドバイ", "https://dubaiairports.ae/", "OMDB"],
  ["DOH", "ドーハ", "", "OTHH"],
  ["AUH", "アブダビ", "", "OMAA"],
  ["SYD", "シドニー", "", "YSSY"],
  ["MEL", "メルボルン", "", "YMML"],
  ["AKL", "オークランド", "", "NZAA"]
];

window.FO_AIRPORT_LINK_MAP = {};
window.FO_AIRPORT_LINKS.forEach(function (a) { window.FO_AIRPORT_LINK_MAP[a[0]] = a; });

/* その他の定番ツール（リンク集の下部に表示） */
window.FO_TOOLS = [
  ["Flightradar24", "全世界の便・機体・空港ボード", "https://www.flightradar24.com/"],
  ["FlightAware", "運航状況・機体履歴・空港IFR", "https://www.flightaware.com/"],
  ["ADS-B Exchange", "遮蔽のないADS-B（軍用機も）", "https://globe.adsbexchange.com/"],
  ["OpenSky Network", "オープンな航空機データ", "https://opensky-network.org/"],
  ["Planespotters", "機体写真・登録機体DB", "https://www.planespotters.net/"],
  ["JetPhotos", "機体写真（レジ検索）", "https://www.jetphotos.com/"],
  ["Airfleets", "機材・製造番号・運用歴", "https://www.airfleets.net/"],
  ["AirNav RadarBox", "ADS-B ライブ", "https://www.radarbox.com/"]
];
