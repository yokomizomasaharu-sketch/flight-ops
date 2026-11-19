/* ============================================================
   FLIGHT OPS  航空会社データ (airlines_data.js)
   ------------------------------------------------------------
   形式: [IATA2, ICAO3, 日本語名, 英語名, 公式サイト, 運航状況ページ(未確認は"")]
   ICAO3 は ADS-B のコールサイン照会（adsbdb）に使用。
   ・FlightAware の運航状況: https://www.flightaware.com/live/fleet/{ICAO3}
   ・Flightradar24 の便:     https://www.flightradar24.com/data/flights/{便名}
   公開情報のみ。個人情報は含みません。
   ============================================================ */
window.FO_AIRLINES = [
  // --- 日本 ---
  ["JL", "JAL", "日本航空", "Japan Airlines", "https://www.jal.co.jp/", "https://www.jal.co.jp/flight-status/"],
  ["NH", "ANA", "全日本空輸（ANA）", "All Nippon Airways", "https://www.ana.co.jp/", ""],
  ["7G", "SFJ", "スターフライヤー", "StarFlyer", "https://www.starflyer.jp/", ""],
  ["MM", "APJ", "ピーチ（Peach）", "Peach Aviation", "https://www.flypeach.com/", ""],
  ["GK", "JJP", "ジェットスター・ジャパン", "Jetstar Japan", "https://www.jetstar.com/jp/ja/home", ""],
  ["ZG", "TZP", "ZIPAIR", "ZIPAIR Tokyo", "https://www.zipair.net/", "https://www.zipair.net/ja/flightstatus"],
  ["6J", "SNG", "ソラシドエア", "Solaseed Air", "https://www.solaseedair.jp/", ""],
  ["BC", "SKY", "スカイマーク", "Skymark Airlines", "https://www.skymark.co.jp/", "https://www.skymark.co.jp/ja/flight/status.html"],
  ["HD", "ADO", "AIRDO", "Air Do", "https://www.airdo.jp/", ""],
  ["IJ", "SJO", "スプリング・ジャパン", "Spring Japan", "https://www.springjapan.com/", ""],
  ["NU", "JTA", "日本トランスオーシャン航空", "Japan Transocean Air", "https://www.jal.co.jp/jta/", ""],
  ["EH", "JAC", "日本エアコミューター", "Japan Air Commuter", "https://www.jac.co.jp/", ""],
  ["MZ", "AMX", "天草エアライン", "Amakusa Airlines", "https://www.amx.co.jp/", ""],
  ["OC", "ORC", "オリエンタルエアブリッジ", "Oriental Air Bridge", "https://www.orc-air.co.jp/", ""],
  ["FW", "IBX", "アイベックスエアラインズ", "IBEX Airlines", "https://www.ibexair.co.jp/", ""],
  ["JH", "FDA", "フジドリームエアラインズ", "Fuji Dream Airlines", "https://www.fda.co.jp/", ""],
  // --- 韓国・台湾・香港・中国 ---
  ["KE", "KAL", "大韓航空", "Korean Air", "https://www.koreanair.com/", "https://www.koreanair.com/contents/flight-status"],
  ["OZ", "AAR", "アシアナ航空", "Asiana Airlines", "https://flyasiana.com/", ""],
  ["7C", "JJA", "チェジュ航空", "Jeju Air", "https://www.jejuair.net/", ""],
  ["TW", "TWB", "ティーウェイ航空", "T'way Air", "", ""],
  ["LJ", "JNA", "ジンエアー", "Jin Air", "https://www.jinair.com/", ""],
  ["BX", "ABL", "エアプサン", "Air Busan", "https://www.airbusan.com/", ""],
  ["BR", "EVA", "エバー航空", "EVA Air", "https://www.evaair.com/ja-jp/", "https://www.evaair.com/ja-jp/manage-your-trip/flight-status/"],
  ["CI", "CAL", "チャイナエアライン", "China Airlines", "https://www.china-airlines.com/jp/ja", "https://www.china-airlines.com/jp/ja/flight/flight-status"],
  ["IT", "TTW", "タイガーエア台湾", "Tigerair Taiwan", "https://www.tigerairtw.com/ja-JP", "https://www.tigerairtw.com/ja-JP/flight-status"],
  ["JX", "SJX", "スターラックス航空", "STARLUX Airlines", "https://www.starlux-airlines.com/", ""],
  ["CX", "CPA", "キャセイパシフィック航空", "Cathay Pacific", "https://www.cathaypacific.com/cx/ja_JP.html", ""],
  ["UO", "HKE", "香港エクスプレス", "HK Express", "https://www.hkexpress.com/", ""],
  ["HX", "CRK", "香港航空", "Hong Kong Airlines", "https://www.hongkongairlines.com/", ""],
  ["MU", "CES", "中国東方航空", "China Eastern", "https://www.ceair.com/", ""],
  ["CA", "CCA", "中国国際航空", "Air China", "https://www.airchina.jp/", ""],
  ["CZ", "CSN", "中国南方航空", "China Southern", "https://www.csair.com/", ""],
  ["HO", "DKH", "吉祥航空", "Juneyao Air", "https://www.juneyaoair.com/", ""],
  ["MF", "CXA", "廈門航空", "XiamenAir", "https://www.xiamenair.com/", ""],
  // --- 東南アジア・南アジア ---
  ["SQ", "SIA", "シンガポール航空", "Singapore Airlines", "https://www.singaporeair.com/ja_JP/jp/home", "https://www.singaporeair.com/ja_JP/jp/flight-status/"],
  ["TR", "SCO", "スクート", "Scoot", "https://www.flyscoot.com/", ""],
  ["TG", "THA", "タイ国際航空", "Thai Airways", "https://www.thaiairways.com/", ""],
  ["VN", "HVN", "ベトナム航空", "Vietnam Airlines", "https://www.vietnamairlines.com/", ""],
  ["VJ", "VJC", "ベトジェットエア", "VietJet Air", "https://www.vietjetair.com/", ""],
  ["MH", "MAS", "マレーシア航空", "Malaysia Airlines", "https://www.malaysiaairlines.com/", ""],
  ["AK", "AXM", "エアアジア", "AirAsia", "https://www.airasia.com/", ""],
  ["D7", "XAX", "エアアジア X", "AirAsia X", "https://www.airasia.com/", ""],
  ["PR", "PAL", "フィリピン航空", "Philippine Airlines", "https://www.philippineairlines.com/", ""],
  ["5J", "CEB", "セブパシフィック", "Cebu Pacific", "https://www.cebupacificair.com/", ""],
  ["GA", "GIA", "ガルーダ・インドネシア", "Garuda Indonesia", "https://www.garuda-indonesia.com/", ""],
  ["PG", "BKP", "バンコク・エアウェイズ", "Bangkok Airways", "https://www.bangkokair.com/", ""],
  // --- 北米・ハワイ ---
  ["UA", "UAL", "ユナイテッド航空", "United Airlines", "https://www.united.com/", ""],
  ["DL", "DAL", "デルタ航空", "Delta Air Lines", "https://www.delta.com/", ""],
  ["AA", "AAL", "アメリカン航空", "American Airlines", "https://www.aa.com/", "https://www.aa.com/ja/flight-status"],
  ["HA", "HAL", "ハワイアン航空", "Hawaiian Airlines", "https://www.hawaiianairlines.com/", ""],
  ["AS", "ASA", "アラスカ航空", "Alaska Airlines", "https://www.alaskaair.com/", ""],
  ["AC", "ACA", "エア・カナダ", "Air Canada", "https://www.aircanada.com/", ""],
  // --- ヨーロッパ・中東 ---
  ["LH", "DLH", "ルフトハンザ", "Lufthansa", "https://www.lufthansa.com/", ""],
  ["AF", "AFR", "エールフランス", "Air France", "https://wwws.airfrance.jp/", ""],
  ["KL", "KLM", "KLMオランダ航空", "KLM", "https://www.klm.com/", ""],
  ["BA", "BAW", "ブリティッシュ・エアウェイズ", "British Airways", "https://www.britishairways.com/", ""],
  ["AZ", "ITY", "ITAエアウェイズ", "ITA Airways", "https://www.ita-airways.com/", ""],
  ["EK", "UAE", "エミレーツ航空", "Emirates", "https://www.emirates.com/", ""],
  ["QR", "QTR", "カタール航空", "Qatar Airways", "https://www.qatarairways.com/", ""],
  ["TK", "THY", "ターキッシュ・エアラインズ", "Turkish Airlines", "https://www.turkishairlines.com/", ""],
  ["EY", "ETD", "エティハド航空", "Etihad Airways", "https://www.etihad.com/", ""],
  ["AY", "FIN", "フィンエアー", "Finnair", "https://www.finnair.com/", ""]
];

/* IATA2 -> レコード の索引 */
window.FO_AIRLINE_MAP = {};
window.FO_AIRLINES.forEach(function (a) { window.FO_AIRLINE_MAP[a[0]] = a; });
window.FO_AIRLINE_ICAO = {};
window.FO_AIRLINES.forEach(function (a) { if (a[1]) window.FO_AIRLINE_ICAO[a[0]] = a[1]; });
