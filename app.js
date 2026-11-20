/* ============================================================
   FLIGHT OPS  app.js
   機材運用・発着ボード（羽田/成田/福岡は公式データを自動取得）
   ============================================================ */
(function () {
  'use strict';

  var BOARD_REMOTE = 'https://raw.githubusercontent.com/yokomizomasaharu-sketch/flight-ops/data/boards.json';
  var BOARD_LOCAL = 'data/boards.json';
  var LS = {
    apts: 'fo.favAirports',
    crew: 'fo.favAircraft',
    board: 'fo.lastBoard',
    apt: 'fo.lastAirport'
  };
  var DEFAULT_APTS = ['HND', 'KIX', 'ITM', 'NRT', 'FUK', 'CTS', 'OKA', 'NGO'];

  var state = {
    board: null,          // 取得した boards.json
    dataState: 'idle',    // idle | loading | ok | stale | error
    airport: 'HND',
    dir: 'dep',
    scope: 'dom',
    filter: '',
    favApts: load(LS.apts, DEFAULT_APTS.slice()),
    favCrew: load(LS.crew, []),
    acQuery: '',
    linkFilter: ''
  };

  /* ---------------- helpers ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function load(k, def) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; }
  }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // 便名の先頭ゼロを整える（成田の "MM0559" → "MM559"）
  function cleanFlt(s) {
    return String(s || '').split(/\s+/).map(function (t) {
      return t.replace(/^([A-Z0-9]{2})0+(\d)/, '$1$2');
    }).join(' ');
  }
  function toast(msg) {
    var t = el('div', 'toast', esc(msg));
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1900);
  }

  /* ---------------- 空港索引 ---------------- */
  var APTS = (window.FLIGHT_WATCH_AIRPORTS && window.FLIGHT_WATCH_AIRPORTS.airports) || [];
  var APT_BY_IATA = {};
  APTS.forEach(function (a) { if (!APT_BY_IATA[a[0]]) APT_BY_IATA[a[0]] = a; });

  function aptName(iata) {
    var l = window.FO_AIRPORT_LINK_MAP[iata];
    if (l && l[1]) return l[1];
    var a = APT_BY_IATA[iata];
    if (!a) return iata;
    return a[7] || a[8] || a[1] || iata;
  }
  function aptCity(iata) {
    var a = APT_BY_IATA[iata];
    if (!a) return '';
    return a[8] || a[2] || '';
  }

  /* ---------------- URL ヘルパ ---------------- */
  var U = {
    fr24AptDep: function (i) { return 'https://www.flightradar24.com/data/airports/' + i.toLowerCase() + '/departures'; },
    fr24AptArr: function (i) { return 'https://www.flightradar24.com/data/airports/' + i.toLowerCase() + '/arrivals'; },
    fr24Flight: function (n) { return 'https://www.flightradar24.com/data/flights/' + n.toLowerCase(); },
    fr24Reg: function (r) { return 'https://www.flightradar24.com/data/aircraft/' + r.toLowerCase(); },
    faFlight: function (n) { return 'https://www.flightaware.com/live/flight/' + encodeURIComponent(n); },
    faReg: function (r) { return 'https://www.flightaware.com/resources/registration/' + encodeURIComponent(r); },
    faApt: function (icao) { return 'https://www.flightaware.com/live/airport/' + icao; },
    adsbx: function (r) { return 'https://globe.adsbexchange.com/?reg=' + encodeURIComponent(r); },
    jetphotos: function (r) { return 'https://www.jetphotos.com/registration/' + encodeURIComponent(r); },
    planespotters: function (r) { return 'https://www.planespotters.net/photos/reg/' + encodeURIComponent(r); },
    airfleets: function (r) { return 'https://www.airfleets.net/recherche/?key=' + encodeURIComponent(r); }
  };

  /* ---------------- データ取得 ---------------- */
  function setLive(stateName, text) {
    var pill = $('#livePill'), t = $('#liveText');
    pill.className = 'pill ' + (stateName === 'ok' ? 'live' : stateName === 'stale' ? 'warn' : 'link');
    t.textContent = text;
  }

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  var refreshing = false;
  function loadBoard(manual) {
    if (refreshing) return;
    refreshing = true;
    if (!state.board) setLive('link', 'SYNC');
    var bust = (BOARD_REMOTE.indexOf('?') < 0 ? '?' : '&') + 'v=' + Date.now();
    fetchJSON(BOARD_REMOTE + bust)
      .catch(function () { return fetchJSON(BOARD_LOCAL + '?v=' + Date.now()); })
      .then(function (d) {
        if (!d || !d.airports) throw new Error('empty');
        state.board = d;
        state.dataState = 'ok';
        save(LS.board, d);
        afterBoardLoaded();
        if (manual) toast('最新を取得しました');
      })
      .catch(function (e) {
        var cached = load(LS.board, null);
        if (cached && cached.airports) {
          state.board = cached;
          state.dataState = 'stale';
          afterBoardLoaded();
          if (manual) toast('最新を取得できず、保存分を表示中');
        } else {
          state.dataState = 'error';
          renderBoard();
          renderStamp();
          setLive('link', 'OFFLINE');
          if (manual) toast('データを取得できません');
        }
      })
      .then(function () { refreshing = false; });
  }

  function afterBoardLoaded() {
    renderChips();
    renderBoardHead();
    renderBoard();
    renderStamp();
    setLive(state.dataState === 'stale' ? 'stale' : 'ok',
      state.dataState === 'stale' ? 'CACHED' : 'AUTO');
  }

  function stampText() {
    if (!state.board) return '—';
    var g = state.board.jst || '';
    var t = g.slice(11, 16);
    var air = state.board.airports && state.board.airports[state.airport];
    if (air && air.asOf) {
      var m = air.asOf.match(/(\d{1,2})時(\d{1,2})分/);
      if (m) return pad(+m[1]) + ':' + m[2] + ' 現在';
      return air.asOf;
    }
    return t ? t + ' 取得' : '—';
  }

  function renderStamp() {
    var b = $('#boardStamp');
    if (!state.board) { b.textContent = '—'; return; }
    var air = state.board.airports && state.board.airports[state.airport];
    if (!air) {
      b.textContent = 'ライブ対象外 ・ 公式/FR24へ';
      setLive('link', 'LINK');
      return;
    }
    b.textContent = 'LIVE ' + stampText();
    var ageMin = state.board.generatedAt ? (Date.now() - Date.parse(state.board.generatedAt)) / 60000 : 0;
    if (state.dataState === 'stale') setLive('stale', 'CACHED');
    else if (ageMin > 45) setLive('stale', 'STALE');
    else setLive('ok', 'AUTO');
  }

  /* ---------------- 空港チップ ---------------- */
  function renderChips() {
    var wrap = $('#aptChips');
    wrap.innerHTML = '';
    state.favApts.forEach(function (iata) {
      var live = state.board && state.board.airports && state.board.airports[iata];
      var b = el('button', 'chip' + (iata === state.airport ? ' on' : ''),
        '<b>' + esc(iata) + '</b>' + esc(aptName(iata)) + (live ? ' ●' : ''));
      b.setAttribute('data-iata', iata);
      b.onclick = function () { setAirport(iata); };
      wrap.appendChild(b);
    });
    var add = el('button', 'chip add', '＋');
    add.setAttribute('aria-label', '空港を追加');
    add.onclick = openAptModal;
    wrap.appendChild(add);
  }

  function setAirport(iata) {
    state.airport = iata;
    save(LS.apt, iata);
    state.filter = '';
    var f = $('#fltFilter'); if (f) f.value = '';
    renderChips(); renderBoardHead(); renderBoard(); renderStamp();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- 空港ヘッダ ---------------- */
  function renderBoardHead() {
    var iata = state.airport;
    var air = state.board && state.board.airports && state.board.airports[iata];
    var link = window.FO_AIRPORT_LINK_MAP[iata] || null;
    var host = $('#aptHead');
    var html = '' +
      '<div class="apt-head">' +
        '<div>' +
          '<div class="apt-code">' + esc(iata) + '</div>' +
          '<div class="apt-name">' + esc(aptName(iata)) + '</div>' +
          '<div class="apt-sub">' + esc(aptCity(iata) || '') + (air ? ' ・ ' + esc(air.src) : '') + '</div>' +
        '</div>' +
        '<div class="apt-actions">' +
          (air ? '<span class="pill live"><span class="dot"></span>AUTO</span>'
               : '<span class="pill link">LINK</span>') +
        '</div>' +
      '</div>';
    host.innerHTML = html;
  }

  /* ---------------- ボード描画 ---------------- */
  function statusClass(s) {
    if (!s) return 's-none';
    if (/欠航|中止|運休/.test(s)) return 's-cancel';
    if (/遅延|変更|遅れ/.test(s)) return 's-delay';
    if (/出発済|到着済|搭乗終了|出発しました|到着しました/.test(s)) return 's-done';
    if (/搭乗中|手続|検査|出国|受付|搭乗/.test(s)) return 's-live';
    if (/定刻|到着|出発|ontime|on time/i.test(s)) return 's-ok';
    return 's-live';
  }

  function boardKey() { return state.scope + '_' + state.dir; }

  function rowsFor(scope, dir) {
    var air = state.board && state.board.airports && state.board.airports[state.airport];
    if (!air || !air.boards) return null;
    return air.boards[scope + '_' + dir] || [];
  }

  function renderBoard() {
    var host = $('#boardArea');
    var note = $('#boardNote');
    var iata = state.airport;
    var link = window.FO_AIRPORT_LINK_MAP[iata] || null;

    if (!state.board) {
      host.innerHTML = '<div class="board"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>';
      note.textContent = '公式データを取得しています…';
      return;
    }

    var air = state.board.airports && state.board.airports[iata];
    if (!air) {
      // ライブ自動取得の対象外 → 公式・FR24・FlightAware への直結
      var icao = link && link[3];
      var official = link && link[2];
      host.innerHTML = '' +
        '<div class="linkcard">' +
          '<h4>' + esc(aptName(iata)) + '（' + esc(iata) + '）の運航情報</h4>' +
          '<p>この空港は公式サイトがブラウザからの直接取得（CORS）を許可していないため、' +
          'ボードの自動取得は行わず、公式フライト情報と Flightradar24 / FlightAware へ 1 タップで開ける形にしています。</p>' +
          '<div class="btnrow">' +
            (official ? '<a class="btn primary wide" href="' + official + '" target="_blank" rel="noopener">公式フライト情報を開く</a>' : '') +
            '<a class="btn" href="' + U.fr24AptDep(iata) + '" target="_blank" rel="noopener">FR24 出発</a>' +
            '<a class="btn" href="' + U.fr24AptArr(iata) + '" target="_blank" rel="noopener">FR24 到着</a>' +
            (icao ? '<a class="btn wide" href="' + U.faApt(icao) + '" target="_blank" rel="noopener">FlightAware（' + esc(icao) + '）</a>' : '') +
          '</div>' +
        '</div>';
      note.innerHTML = '<b>自動取得できる空港</b>：羽田・成田・福岡（10分ごと更新）。' +
        'その他の空港は公式サイト／FR24／FlightAware へ直結します。';
      return;
    }

    var rows = rowsFor(state.scope, state.dir) || [];
    var q = state.filter.trim().toUpperCase();
    var list = q ? rows.filter(function (r) {
      return (r[3] || '').toUpperCase().indexOf(q) >= 0 ||
             (r[4] || '').toUpperCase().indexOf(q) >= 0 ||
             (r[2] || '').toUpperCase().indexOf(q) >= 0;
    }) : rows;

    var head = '' +
      '<div class="board">' +
        '<div class="board-head">' +
          '<span>' + (state.dir === 'dep' ? '出発' : '到着') + '時刻</span>' +
          '<span>' + (state.dir === 'dep' ? '行き先 / 便名' : '出発地 / 便名') + '</span>' +
          '<span style="text-align:right">ゲート</span>' +
        '</div>';

    if (!list.length) {
      host.innerHTML = head + '<div class="empty">' +
        (rows.length ? '条件に合う便がありません' : 'この区分の便はありません（' +
          (state.scope === 'dom' ? '国内線' : '国際線') + '・' + (state.dir === 'dep' ? '出発' : '到着') + '）') +
        '</div></div>';
    } else {
      var html = head;
      list.slice(0, 700).forEach(function (r, idx) {
        var st = r[7] || '';
        html += '<button class="fl" data-i="' + idx + '">' +
          '<div class="times"><div class="t-sched">' + esc(r[0]) + '</div>' +
          (r[1] ? '<div class="t-chg">' + esc(r[1]) + '</div>' : '') + '</div>' +
          '<div><div class="dest">' + esc(r[3] || r[2]) + '</div>' +
          '<div class="fltno">' + esc(cleanFlt(r[4])) + '</div></div>' +
          '<div class="right">' +
            '<span class="gate' + (r[6] ? '' : ' none') + '">' + (r[6] ? esc(r[6]) : '—') + '</span>' +
            (r[5] ? '<span class="term">' + esc(r[5]) + '</span>' : '') +
            '<span class="st ' + statusClass(st) + '">' + esc(st) + '</span>' +
          '</div>' +
        '</button>';
      });
      html += '</div>';
      host.innerHTML = html;
      Array.prototype.forEach.call(host.querySelectorAll('.fl'), function (b) {
        b.onclick = function () {
          var idx = +b.getAttribute('data-i');
          var filtered = q ? list : rows;
          openFlightSheet(filtered[idx]);
        };
      });
    }

    note.innerHTML = '<b>' + esc(air.src) + '</b> の公開データを10分ごとに取得（' + esc(air.asOf || '') + '）。' +
      'ゲートは変更されることがあります。当日の最新は公式サイトでご確認ください。' +
      (state.board.generatedAt && (Date.now() - Date.parse(state.board.generatedAt)) > 45 * 60000
        ? ' <b style="color:#ffc44d">※最終取得から時間が経っています（自動更新の遅延）。</b>' : '') +
      (state.dataState === 'stale' ? ' ※現在オフライン保存分を表示中。' : '');
  }

  /* ---------------- 便の詳細シート ---------------- */
  function openFlightSheet(r) {
    if (!r) return;
    var iata = state.airport;
    var air = state.board.airports[iata];
    var flt = cleanFlt((r[4] || '').split(/\s+/)[0] || '');
    var st = r[7] || '';
    var dirLabel = state.dir === 'dep' ? '出発' : '到着';
    var other = state.dir === 'dep' ? '到着' : '出発';

    var html = '' +
      '<div class="grab"></div>' +
      '<h2>' + esc(r[3] || r[2]) + ' <span class="c">' + esc(flt) + '</span></h2>' +
      '<div class="sub">' + esc(aptName(iata)) + '（' + esc(iata) + '）' + dirLabel + ' ・ ' + esc(air.src) + '</div>' +
      '<div class="bigtime">' + esc(r[0]) + (r[1] ? '<s>' + esc(r[1]) + '</s>' : '') + '</div>' +
      '<div class="kv">' +
        '<dt>ゲート</dt><dd>' + (r[6] ? esc(r[6]) : '—（未確定）') + '</dd>' +
        '<dt>ターミナル</dt><dd>' + (r[5] ? esc(r[5]) : '—') + '</dd>' +
        '<dt>ステータス</dt><dd>' + (st ? '<span class="st ' + statusClass(st) + '">' + esc(st) + '</span>' : '—') + '</dd>' +
        '<dt>便名</dt><dd class="mono">' + esc(cleanFlt(r[4]) || '—') + '</dd>' +
      '</div>' +
      '<div class="linkgrid">' +
        (flt ? '<a class="linkbtn" href="' + U.fr24Flight(flt) + '" target="_blank" rel="noopener"><b>Flightradar24 便</b><span>使用機材・現在位置・履歴</span></a>' : '') +
        (flt ? '<a class="linkbtn" href="' + U.faFlight(flt) + '" target="_blank" rel="noopener"><b>FlightAware 便</b><span>運航状況・遅延</span></a>' : '') +
        '<a class="linkbtn" href="' + (state.dir === 'dep' ? U.fr24AptDep(iata) : U.fr24AptArr(iata)) + '" target="_blank" rel="noopener"><b>FR24 空港ボード</b><span>' + esc(iata) + ' の' + dirLabel + '</span></a>' +
        (r[2] && APT_BY_IATA[r[2]] ? '<a class="linkbtn" href="' + U.fr24AptArr(r[2]) + '" target="_blank" rel="noopener"><b>' + esc(aptName(r[2])) + ' の' + other + '</b><span>相手空港のボード</span></a>' : '') +
      '</div>' +
      (flt ? '<div class="btnrow" style="margin-top:8px"><button class="btn violet wide" id="favFlight">この便を機材運用に登録</button></div>' : '');

    openSheet(html);
    var fb = $('#favFlight');
    if (fb) fb.onclick = function () {
      addFav(flt);
      closeSheet();
      switchTab('aircraft');
      $('#acInput').value = flt;
      doAircraftSearch(flt);
    };
  }

  /* ---------------- シート ---------------- */
  function openSheet(html) {
    var host = $('#sheetHost');
    host.innerHTML = '<div class="sheet-wrap"><div class="sheet">' + html + '</div></div>';
    var wrap = host.firstChild;
    wrap.onclick = function (e) { if (e.target === wrap) closeSheet(); };
  }
  function closeSheet() { $('#sheetHost').innerHTML = ''; }

  /* ---------------- 空港検索モーダル ---------------- */
  function openAptModal() {
    var host = $('#modalHost');
    host.innerHTML = '' +
      '<div class="modal">' +
        '<div class="mhead">' +
          '<div class="searchbox" style="margin:0">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
            '<input id="aptSearch" placeholder="空港名・都市・3レター（例 関西 / KIX / Seoul）" autocomplete="off">' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">' +
            '<span class="pill">全 ' + (window.FLIGHT_WATCH_AIRPORTS ? window.FLIGHT_WATCH_AIRPORTS.count : APTS.length) + ' 空港</span>' +
            '<button class="btn" id="aptClose" style="padding:6px 12px;font-size:11px">閉じる</button>' +
          '</div>' +
        '</div>' +
        '<div class="mlist" id="aptList"></div>' +
      '</div>';
    var input = $('#aptSearch');
    $('#aptClose').onclick = function () { host.innerHTML = ''; };
    input.oninput = function () { renderAptList(input.value); };
    renderAptList('');
    setTimeout(function () { input.focus(); }, 60);
  }

  function renderAptList(q) {
    var list = $('#aptList');
    var qq = (q || '').trim().toLowerCase();
    var out = [];
    if (!qq) {
      // 既定：主要＋日本の空港
      var seen = {};
      ['HND', 'NRT', 'KIX', 'ITM', 'FUK', 'CTS', 'OKA', 'NGO', 'SDJ', 'HIJ', 'KOJ', 'KMJ', 'TPE', 'ICN', 'SIN', 'BKK', 'HKG', 'PVG', 'LAX', 'HNL', 'GUM', 'LHR', 'CDG'].forEach(function (i) {
        var a = APT_BY_IATA[i];
        if (a && !seen[i]) { out.push(a); seen[i] = 1; }
      });
      APTS.forEach(function (a) { if (a[3] === 'JP' && !seen[a[0]]) { out.push(a); seen[a[0]] = 1; } });
    } else {
      APTS.forEach(function (a) {
        var hay = (a.join(' ') + ' ' + (window.FLIGHT_WATCH_AIRPORTS.countries[a[3]] || '')).toLowerCase();
        if (hay.indexOf(qq) >= 0) out.push(a);
      });
      out.sort(function (x, y) { return (x[6] || 3) - (y[6] || 3); });
      out = out.slice(0, 80);
    }
    var html = '';
    out.slice(0, 120).forEach(function (a) {
      var nm = a[7] || a[1] || a[0];
      var city = a[8] || a[2] || '';
      var live = state.board && state.board.airports && state.board.airports[a[0]];
      html += '<button data-iata="' + esc(a[0]) + '">' +
        '<span class="iata">' + esc(a[0]) + '</span>' +
        '<span class="an">' + esc(nm) + '<small>' + esc(city) + (city ? ' · ' : '') + esc(a[3]) + (live ? ' · ライブ対応' : '') + '</small></span>' +
        '<span class="go">›</span></button>';
    });
    list.innerHTML = html || '<div class="note">見つかりませんでした</div>';
    Array.prototype.forEach.call(list.querySelectorAll('button'), function (b) {
      b.onclick = function () {
        var iata = b.getAttribute('data-iata');
        $('#modalHost').innerHTML = '';
        if (state.favApts.indexOf(iata) < 0) {
          state.favApts.push(iata);
          save(LS.apts, state.favApts);
        }
        setAirport(iata);
      };
    });
  }

  /* ---------------- 機材運用 ---------------- */
  function normReg(s) { return (s || '').toUpperCase().replace(/[^A-Z0-9-]/g, ''); }

  function parseQuery(v) {
    var s = (v || '').trim().toUpperCase().replace(/\s+/g, '').replace(/^0X/, '');
    if (!s) return null;
    // ICAO24 hex（例 8406E8）: 先頭が数字の6桁16進はレジ番ではなく機体hexとして扱う
    if (/^[0-9][0-9A-F]{5}$/.test(s)) return { type: 'hex', hex: s };
    var m = s.match(/^([A-Z0-9]{2})(\d{1,4})([A-Z]?)$/);
    if (m && window.FO_AIRLINE_ICAO[m[1]]) {
      return { type: 'flight', iata: m[1], num: m[2], suffix: m[3] || '', flight: m[1] + m[2] + (m[3] || ''), callsign: window.FO_AIRLINE_ICAO[m[1]] + m[2] };
    }
    if (/^[A-Z]{1,2}-?[A-Z0-9]{3,5}$/.test(s) && /\d/.test(s)) return { type: 'reg', reg: s };
    if (/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(s)) return { type: 'flight', flight: s, iata: s.slice(0, 2), num: s.slice(2) };
    if (/^[0-9A-F]{6}$/.test(s)) return { type: 'hex', hex: s };
    return { type: 'unknown', raw: s };
  }

  function addFav(code) {
    var c = code.toUpperCase();
    if (state.favCrew.indexOf(c) < 0) {
      state.favCrew.unshift(c);
      state.favCrew = state.favCrew.slice(0, 12);
      save(LS.crew, state.favCrew);
      renderFavCrew();
    }
  }

  function renderFavCrew() {
    var host = $('#acFavs');
    if (!host) return;
    host.innerHTML = '';
    state.favCrew.forEach(function (c) {
      var b = el('button', 'fav', esc(c) + ' <span class="x">×</span>');
      b.onclick = function (e) {
        if (e.target.className === 'x') {
          state.favCrew = state.favCrew.filter(function (x) { return x !== c; });
          save(LS.crew, state.favCrew); renderFavCrew();
        } else {
          $('#acInput').value = c; doAircraftSearch(c);
        }
      };
      host.appendChild(b);
    });
    if (!state.favCrew.length) host.innerHTML = '<span style="font-size:10.5px;color:var(--dim2)">よく見る機体・便を登録できます（履歴カードのボタンから）</span>';
    renderFavHist();
  }

  /* ---------- 飛行履歴（Flightradar24 公開エンドポイント） ----------
     ・レジ番/hex で「直近7日・最大100便」の運航履歴（出発地→到着地・便名・日時・状態）を取得
     ・便名でも「その便名の最近の運航と使用機材」を取得
     ・取得結果は localStorage に15分キャッシュ（お気に入り機体の履歴をすぐ開けるように）
  ---------------------------------------------------------------- */
  var FR24_LIST = 'https://api.flightradar24.com/common/v1/flight/list.json';
  var HIST_TTL = 15 * 60 * 1000;
  var HIST_LIMIT = 100;
  var histBusy = {};

  function histKey(k) { return 'fo.hist.v2.' + k; }
  function histGet(k) {
    var v = load(histKey(k), null);
    return (v && v.list && v.list.length) ? v : null;
  }
  function histPut(k, list) {
    try { save(histKey(k), { at: Date.now(), list: list.slice(0, HIST_LIMIT) }); } catch (e) { }
  }

  // UNIX秒 → JST の各部分
  function jst(ts) {
    if (!ts) return null;
    var d = new Date(ts * 1000);
    var j = new Date(d.getTime() + (d.getTimezoneOffset() + 540) * 60000);
    return {
      ymd: j.getFullYear() + '-' + pad(j.getMonth() + 1) + '-' + pad(j.getDate()),
      md: (j.getMonth() + 1) + '/' + pad(j.getDate()),
      hm: pad(j.getHours()) + ':' + pad(j.getMinutes()),
      wd: ['日', '月', '火', '水', '木', '金', '土'][j.getDay()]
    };
  }
  function fmtAt(ts) {
    var p = ts ? jst(Math.floor(ts / 1000)) : null;
    return p ? p.md + ' ' + p.hm : '—';
  }

  function fr24List(query, by) {
    var id = by + ':' + query;
    if (histBusy[id]) return Promise.reject(new Error('busy'));
    histBusy[id] = 1;
    var url = FR24_LIST + '?query=' + encodeURIComponent(query) + '&fetchBy=' + by + '&limit=' + HIST_LIMIT + '&page=1';
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) { } }, 12000) : null;
    return fetch(url, { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        var res = j && j.result && j.result.response;
        if (!res) throw new Error('no data');
        return res;
      })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        delete histBusy[id];
        return res;
      }, function (e) {
        if (timer) clearTimeout(timer);
        delete histBusy[id];
        throw e;
      });
  }

  // FR24 の便配列 → アプリ用の軽い形（新しい順）
  function normFlights(data) {
    var out = [];
    (data || []).forEach(function (f) {
      var t = f.time || {}, ap = f.airport || {};
      var s = t.scheduled || {}, r = t.real || {}, e2 = t.estimated || {};
      var dep = s.departure || r.departure || e2.departure || 0;
      var arr = s.arrival || r.arrival || e2.arrival || 0;
      if (!dep && !arr) return;
      // 6時間より先の「まだ飛んでいない便」は履歴から外す
      if (dep > (Date.now() / 1000) + 6 * 3600) return;
      var o = ap.origin, d = ap.destination;
      out.push({
        dep: dep, arr: arr, rdep: r.departure || 0, rarr: r.arrival || 0,
        flt: (f.identification && f.identification.number && f.identification.number.default) || '',
        o: (o && o.code && o.code.iata) || '',
        dst: (d && d.code && d.code.iata) || '',
        st: (f.status && f.status.text) || '',
        reg: (f.aircraft && f.aircraft.registration) || ''
      });
    });
    out.sort(function (a, b) { return (b.dep || b.arr) - (a.dep || a.arr); });
    return out;
  }

  function stInfo(s) {
    s = s || '';
    if (/^landed/i.test(s)) return { text: '着陸', cls: 's-done' };
    if (/^cancel/i.test(s)) return { text: '欠航', cls: 's-cancel' };
    if (/^divert/i.test(s)) return { text: '代替着', cls: 's-cancel' };
    if (/^delayed/i.test(s)) return { text: '遅延', cls: 's-delay' };
    if (/^estimated/i.test(s)) return { text: '推定', cls: 's-live' };
    if (/^scheduled/i.test(s)) return { text: '定刻', cls: 's-ok' };
    if (!s) return { text: '—', cls: 's-none' };
    return { text: s.split(/[\s(]/)[0], cls: 's-live' };
  }

  function histStats(list) {
    var apts = {}, routes = {}, delays = [];
    list.forEach(function (e) {
      if (e.o) apts[e.o] = 1;
      if (e.dst) apts[e.dst] = 1;
      if (e.o && e.dst) {
        var k = [e.o, e.dst].sort().join('=');
        routes[k] = (routes[k] || 0) + 1;
      }
      if (/^landed/i.test(e.st) && e.rdep && e.dep) {
        var m = Math.round((e.rdep - e.dep) / 60);
        if (Math.abs(m) < 600) delays.push(m);
      }
    });
    var rk = Object.keys(routes).sort(function (a, b) { return routes[b] - routes[a]; })
      .slice(0, 4).map(function (k) {
        var p = k.split('=');
        return { r: p[0] + '⇄' + p[1], n: routes[k] };
      });
    var avg = delays.length ? Math.round(delays.reduce(function (a, b) { return a + b; }, 0) / delays.length) : null;
    var newest = list.length ? jst(list[0].dep || list[0].arr) : null;
    var oldest = list.length ? jst(list[list.length - 1].dep || list[list.length - 1].arr) : null;
    return {
      n: list.length,
      apts: Object.keys(apts),
      routes: rk,
      avg: avg,
      span: (oldest && newest) ? oldest.md + '〜' + newest.md : '—',
      multi: {}
    };
  }

  function histDayGroups(list, limit) {
    var days = [], map = {};
    list.slice(0, limit).forEach(function (e) {
      var p = jst(e.dep || e.arr);
      var k = p ? p.ymd : '?';
      if (!map[k]) { map[k] = { md: p ? p.md : '—', wd: p ? p.wd : '', items: [] }; days.push(map[k]); }
      map[k].items.push(e);
    });
    return days;
  }

  function histRowAircraft(e) {
    var p = jst(e.dep || e.arr), q = jst(e.arr);
    var st = stInfo(e.st);
    var real = (e.rdep && e.dep && Math.abs(e.rdep - e.dep) >= 60 && !/^landed/i.test(e.st)) ? jst(e.rdep) : null;
    return '<div class="tl-row">' +
      '<div class="tl-t"><b>' + esc(p ? p.hm : '—') + '</b>' + (real ? '<s>' + esc(real.hm) + '</s>' : '') + '</div>' +
      '<div class="tl-l"><i></i></div>' +
      '<div class="tl-m">' +
        '<div class="tl-r"><b class="mono ap">' + esc(e.o || '—') + '</b><span class="arw">→</span><b class="mono ap">' + esc(e.dst || '—') + '</b>' +
          '<span class="st ' + st.cls + '">' + esc(st.text) + '</span></div>' +
        '<div class="tl-s"><span class="mono fno">' + esc(e.flt || '—') + '</span> ・ ' + esc(aptName(e.o)) + '→' + esc(aptName(e.dst)) +
          (q ? ' ・ ' + esc(q.hm) + '着' : '') + '</div>' +
      '</div>' +
    '</div>';
  }

  function histRowFlight(e) {
    var p = jst(e.dep || e.arr), q = jst(e.arr);
    var st = stInfo(e.st);
    return '<button class="tl-row tl-btn" data-reg="' + esc(e.reg) + '">' +
      '<div class="tl-t"><b>' + esc(p ? p.hm : '—') + '</b></div>' +
      '<div class="tl-l"><i></i></div>' +
      '<div class="tl-m">' +
        '<div class="tl-r"><b class="mono ap">' + esc(e.o || '—') + '</b><span class="arw">→</span><b class="mono ap">' + esc(e.dst || '—') + '</b>' +
          '<span class="st ' + st.cls + '">' + esc(st.text) + '</span></div>' +
        '<div class="tl-s">' + (e.reg ? '<b class="mono fno">' + esc(e.reg) + '</b>' : '機材未確定') +
          ' ・ ' + esc(aptName(e.o)) + '→' + esc(aptName(e.dst)) + (q ? ' ・ ' + esc(q.hm) + '着' : '') + '</div>' +
      '</div>' +
    '</button>';
  }

  function histCards(list, limit) {
    return histDayGroups(list, limit).map(function (d) {
      return '<div class="tl-day"><span class="mono">' + esc(d.md) + '</span><span class="wd">(' + esc(d.wd) + ')</span>' +
        '<span class="n">' + d.items.length + '便</span></div>' +
        d.items.map(histRowAircraft).join('');
    }).join('');
  }

  function histSummaryHtml(s) {
    var h = '<div class="hist-sum">' +
      '<div class="hs"><b>' + s.n + '</b><span>便</span></div>' +
      '<div class="hs"><b>' + s.apts.length + '</b><span>空港</span></div>' +
      '<div class="hs"><b>' + (s.avg == null ? '—' : (s.avg > 0 ? '+' : '') + s.avg + '<small>分</small>') + '</b><span>平均遅延</span></div>' +
      '<div class="hs"><b class="mono">' + esc(s.span) + '</b><span>期間</span></div>' +
    '</div>';
    if (s.routes.length) {
      h += '<div class="hist-routes">' + s.routes.map(function (r) {
        return '<span class="rchip"><b class="mono">' + esc(r.r) + '</b> ' + r.n + '便</span>';
      }).join('') + '</div>';
    }
    if (s.apts.length) {
      h += '<div class="hist-apts">' + s.apts.map(function (a) {
        return '<span class="achip"><b class="mono">' + esc(a) + '</b>' + esc(aptName(a)) + '</span>';
      }).join('') + '</div>';
    }
    return h;
  }

  function histCardAircraft(key, reg, list, at) {
    var s = histStats(list);
    var h = '<div class="card hist" id="histCard">' +
      '<div class="hist-h"><h3>これまでの飛行履歴 <span class="mono hreg">' + esc(reg || key) + '</span></h3>' +
      (list.length ? '<span class="pill">直近7日 ・ ' + s.n + '便</span>' : '') + '</div>';

    if (!list.length) {
      h += '<p class="hmsg">直近7日のフライトが見つかりませんでした（運休・整備中・データ未登録）。' +
        'それ以前の履歴は下の FR24 / FlightAware で確認できます。</p>';
    } else {
      h += histSummaryHtml(s);
      h += '<div class="tl" id="histTl">' + histCards(list, 30) + '</div>';
      if (list.length > 30) {
        h += '<button class="hist-more" id="histShowAll">残り ' + (list.length - 30) + ' 便を表示</button>';
      }
      h += '<div class="hist-at">取得 ' + esc(fmtAt(at)) + ' ・ Flightradar24 公開データ（直近7日・最大100便）</div>';
    }

    h += '<div class="btnrow" style="margin-top:10px">' +
        '<a class="btn" href="' + U.fr24Reg(reg || key) + '" target="_blank" rel="noopener">もっと過去（FR24）</a>' +
        '<a class="btn" href="' + U.faReg(reg || key) + '" target="_blank" rel="noopener">FlightAware 履歴</a>' +
        '<button class="btn wide" id="histRefresh">履歴を再取得</button>' +
      '</div>' +
      '<p class="hist-note">出発地→到着地・便名・日時・状態は Flightradar24 の公開データから直接取得。' +
      '無料で取れるのは<b>直近7日・最大100便</b>までで、それ以前の長期履歴は FR24 機体ページ（月別カレンダー）と FlightAware で確認できます。</p>' +
      '</div>';
    return h;
  }

  function histCardFlight(flt, list, at) {
    var regs = {}, delays = [];
    list.forEach(function (e) {
      if (e.reg) regs[e.reg] = (regs[e.reg] || 0) + 1;
      if (/cancel/i.test(e.st)) return;
      if (e.rdep && e.dep) {
        var m = Math.round((e.rdep - e.dep) / 60);
        if (Math.abs(m) < 600) delays.push(m);
      }
    });
    var regList = Object.keys(regs).sort(function (a, b) { return regs[b] - regs[a]; });
    var avg = delays.length ? Math.round(delays.reduce(function (a, b) { return a + b; }, 0) / delays.length) : null;
    var h = '<div class="card hist" id="histCard">' +
      '<div class="hist-h"><h3>便 <span class="mono hreg">' + esc(flt) + '</span> の運航履歴</h3>' +
      (list.length ? '<span class="pill">直近7日 ・ ' + list.length + '便</span>' : '') + '</div>';

    if (!list.length) {
      h += '<p class="hmsg">直近7日の運航記録が見つかりませんでした。下の FR24 便ページでご確認ください。</p>';
    } else {
      h += '<div class="hist-sum">' +
        '<div class="hs"><b>' + list.length + '</b><span>便</span></div>' +
        '<div class="hs"><b>' + regList.length + '</b><span>使用機材</span></div>' +
        '<div class="hs"><b>' + (avg == null ? '—' : (avg > 0 ? '+' : '') + avg + '<small>分</small>') + '</b><span>平均遅延</span></div>' +
        '<div class="hs"><b class="mono">' + esc(list.length ? (jst(list[list.length - 1].dep || list[list.length - 1].arr) || {}).md + '〜' + (jst(list[0].dep || list[0].arr) || {}).md : '—') + '</b><span>期間</span></div>' +
      '</div>';
      if (regList.length) {
        h += '<div class="hist-routes">' + regList.slice(0, 6).map(function (r) {
          return '<button class="rchip reg-jump" data-reg="' + esc(r) + '"><b class="mono">' + esc(r) + '</b> ' + regs[r] + '便</button>';
        }).join('') + '</div>';
        h += '<p class="hist-note" style="margin:6px 0 0">機体をタップすると、その機体の飛行履歴（どこからどこへ飛んだか）を開きます。</p>';
      }
      h += '<div class="tl">' + histDayGroups(list, 30).map(function (d) {
        return '<div class="tl-day"><span class="mono">' + esc(d.md) + '</span><span class="wd">(' + esc(d.wd) + ')</span>' +
          '<span class="n">' + d.items.length + '便</span></div>' + d.items.map(histRowFlight).join('');
      }).join('') + '</div>';
      h += '<div class="hist-at">取得 ' + esc(fmtAt(at)) + ' ・ Flightradar24 公開データ（直近7日）</div>';
    }
    h += '<p class="hist-note">便名の履歴は「その便名を最近どの機材が飛んだか」の記録です。7日より前は FR24 便ページで確認できます。</p></div>';
    return h;
  }

  function histSkeleton(msg) {
    return '<div class="card hist"><div class="hist-h"><h3>' + esc(msg) + '</h3></div>' +
      '<div class="skel" style="height:28px;margin-top:6px"></div>' +
      '<div class="skel" style="height:44px"></div><div class="skel" style="height:44px"></div></div>';
  }

  function histErrorCard(reg, what) {
    return '<div class="card hist" id="histCard"><div class="hist-h"><h3>飛行履歴を取得できませんでした</h3>' +
      '<span class="pill link">OFFLINE</span></div>' +
      '<p class="hmsg">Flightradar24 の公開データに接続できませんでした（通信制限・回線・一時的な遮断の可能性）。' +
      what + 'の履歴は下のリンクから直接確認できます。</p>' +
      '<div class="btnrow" style="margin-top:10px">' +
        '<a class="btn" href="' + U.fr24Reg(reg) + '" target="_blank" rel="noopener">FR24 機体ページ</a>' +
        '<a class="btn" href="' + U.faReg(reg) + '" target="_blank" rel="noopener">FlightAware 履歴</a>' +
        '<button class="btn wide" id="histRefresh">もう一度取得</button>' +
      '</div></div>';
  }

  function wireHist(slot) {
    var all = slot.querySelector('#histShowAll');
    if (all) all.onclick = function () {
      var tl = slot.querySelector('#histTl');
      var at = slot.querySelector('.hist-at');
      var s = slot._list || [];
      tl.innerHTML = histCards(s, HIST_LIMIT);
      all.remove();
      if (at) at.textContent = at.textContent;
    };
    var rf = slot.querySelector('#histRefresh');
    if (rf) rf.onclick = function () { histLoad(slot, slot._mode, slot._key, true); };
    Array.prototype.forEach.call(slot.querySelectorAll('.tl-btn[data-reg], .reg-jump'), function (b) {
      b.onclick = function () {
        var r = b.getAttribute('data-reg');
        if (!r) return;
        $('#acInput').value = r;
        doAircraftSearch(r);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });
  }

  // slot に履歴カードを描く（mode: 'reg' | 'flight'）
  function histLoad(slot, mode, key, force) {
    if (!slot) return;
    slot._mode = mode; slot._key = key;
    var ck = mode + ':' + key;
    var cache = force ? null : histGet(ck);
    var render = function (list, at) {
      if (!document.body.contains(slot)) return;
      slot._list = list;
      slot.innerHTML = (mode === 'reg') ? histCardAircraft(key, slot._reg || key, list, at)
                                        : histCardFlight(key, list, at);
      wireHist(slot);
    };
    if (cache) {
      render(cache.list, cache.at);
      if (Date.now() - cache.at < HIST_TTL) return;
    } else {
      slot.innerHTML = histSkeleton(mode === 'reg' ? 'これまでの飛行履歴を取得中…' : '運航履歴を取得中…');
    }
    fr24List(key, mode === 'reg' ? 'reg' : 'flight').then(function (res) {
      var list = normFlights(res.data);
      histPut(ck, list);
      // 空でも「取れた」ことは覚えておく（毎回叩かない）
      render(list, Date.now());
      renderFavHist();
    }).catch(function () {
      if (!cache && document.body.contains(slot)) {
        slot.innerHTML = histErrorCard(mode === 'reg' ? (slot._reg || key) : key, mode === 'reg' ? '機体' : '便');
        wireHist(slot);
      }
    });
  }

  function adsbAircraft(key) {
    return fetch('https://api.adsbdb.com/v0/aircraft/' + encodeURIComponent(key), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.response && j.response.aircraft) || null; })
      .catch(function () { return null; });
  }

  function doAircraftSearch(v) {
    var host = $('#acResult');
    var q = parseQuery(v);
    state.acQuery = v;
    if (!q) { host.innerHTML = ''; return; }
    if (q.type === 'unknown') {
      host.innerHTML = '<div class="card"><h3>検索できませんでした</h3><p class="sub" style="margin:0">' +
        'レジ番（例 JA01XJ / JA27MC / N12345）、ICAO24 の6桁hex（例 8406E8）、便名（例 NH985 / MM309）のいずれかを入れてください。</p></div>';
      return;
    }
    host.innerHTML = histSkeleton('検索しています…');

    var acKey = (q.type === 'reg') ? q.reg : (q.type === 'hex' ? q.hex : '');
    var callsign = q.type === 'flight' ? q.callsign : '';

    var pAc = acKey ? adsbAircraft(acKey) : Promise.resolve(null);
    var pRoute = callsign
      ? fetch('https://api.adsbdb.com/v0/callsign/' + encodeURIComponent(callsign)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      : Promise.resolve(null);

    Promise.all([pAc, pRoute]).then(function (res) {
      var ac = res[0];
      var route = res[1] && res[1].response && res[1].response.flightroute ? res[1].response.flightroute : null;
      var air = q.type === 'flight' ? window.FO_AIRLINE_MAP[q.iata] : null;
      var reg = (ac && ac.registration) || (q.type === 'reg' ? q.reg : '');
      var html = '';

      if (q.type === 'flight' && air) {
        html += '<div class="card"><h3>便 ' + esc(q.flight) + '</h3>' +
          '<div class="kv">' +
            '<dt>航空会社</dt><dd>' + esc(air[2]) + '（' + esc(air[0]) + ' / ' + esc(air[1]) + '）</dd>' +
            '<dt>ADS-B コールサイン</dt><dd class="mono">' + esc(q.callsign) + '</dd>' +
            (route ? '<dt>現在の運航区間</dt><dd>' + esc((route.origin && route.origin.iata_code) || '') + ' → ' + esc((route.destination && route.destination.iata_code) || '') + '</dd>' : '') +
          '</div>' +
          (route ? '' : '<p class="sub" style="margin-top:8px">※ いま ADS-B で受信できていない便は現在の区間が引けません（運航時間外・圏外）。下の履歴で最近の運航を確認できます。</p>') +
          '</div>';
      }

      if (ac) {
        html += '<div class="card"><h3>機体 ' + esc(ac.registration || acKey) + '</h3>' +
          '<div class="kv">' +
            '<dt>型式</dt><dd>' + esc([ac.icao_type, ac.manufacturer, ac.type].filter(Boolean).join(' / ') || '—') + '</dd>' +
            '<dt>登録</dt><dd class="mono">' + esc(ac.registration || '—') + '</dd>' +
            '<dt>ICAO24</dt><dd class="mono">' + esc(ac.mode_s || (q.type === 'hex' ? q.hex : '—')) + '</dd>' +
            '<dt>運航者</dt><dd>' + esc(ac.registered_owner || '—') + (ac.registered_owner_country_name ? '（' + esc(ac.registered_owner_country_name) + '）' : '') + '</dd>' +
          '</div></div>';
      } else if (q.type === 'reg' || q.type === 'hex') {
        html += '<div class="card"><h3>機体 ' + esc(acKey) + '</h3><p class="sub" style="margin:0">' +
          '登録データベース（adsbdb）に該当がありませんでした。それでも履歴は下で照会します。</p></div>';
      }

      // ▼ ここに飛行履歴タイムラインが入る
      html += '<div id="histSlot"></div>';

      // ボード横断（羽田・成田・福岡）
      var found = crossBoard(reg || q.flight || acKey || '');
      if (found.length) {
        html += '<div class="card"><h3>本日のボード横断 ' + esc(reg || q.flight) + '</h3>';
        found.slice(0, 12).forEach(function (f) {
          html += '<div class="kv" style="grid-template-columns:52px 1fr;border-top:1px solid #16233a;padding-top:6px">' +
            '<dt class="mono" style="color:var(--cyan);font-size:12px">' + esc(f.iata) + '</dt>' +
            '<dd>' + esc(f.time) + ' ' + (f.dir === 'dep' ? '発' : '着') + ' ' + esc(f.dest) + '・ゲート ' + esc(f.gate || '—') +
            ' <span class="st ' + statusClass(f.status) + '">' + esc(f.status || '') + '</span></dd></div>';
        });
        html += '</div>';
      }

      // 外部リンク
      var lk = '';
      if (q.type === 'reg' || q.type === 'hex') {
        var rk = reg || acKey;
        lk += '<a class="linkbtn" href="' + U.fr24Reg(rk) + '" target="_blank" rel="noopener"><b>FR24 機体ページ</b><span>全期間の運航履歴（月別）</span></a>';
        lk += '<a class="linkbtn" href="' + U.faReg(rk) + '" target="_blank" rel="noopener"><b>FlightAware 機体</b><span>運航履歴・登録情報</span></a>';
        lk += '<a class="linkbtn" href="' + U.adsbx(rk) + '" target="_blank" rel="noopener"><b>ADS-B Exchange</b><span>ライブ位置（レジ指定）</span></a>';
        lk += '<a class="linkbtn" href="' + U.planespotters(rk) + '" target="_blank" rel="noopener"><b>Planespotters</b><span>機体写真・型式</span></a>';
        lk += '<a class="linkbtn" href="' + U.airfleets(rk) + '" target="_blank" rel="noopener"><b>Airfleets</b><span>運用歴・製造番号</span></a>';
        lk += '<a class="linkbtn" href="' + U.jetphotos(rk) + '" target="_blank" rel="noopener"><b>JetPhotos</b><span>写真（レジ検索）</span></a>';
      } else if (q.type === 'flight') {
        lk += '<a class="linkbtn" href="' + U.fr24Flight(q.flight) + '" target="_blank" rel="noopener"><b>FR24 便ページ</b><span>使用機材・位置・履歴</span></a>';
        lk += '<a class="linkbtn" href="' + U.faFlight(q.flight) + '" target="_blank" rel="noopener"><b>FlightAware 便</b><span>運航状況・遅延</span></a>';
        if (air && air[5]) lk += '<a class="linkbtn" href="' + air[5] + '" target="_blank" rel="noopener"><b>' + esc(air[2]) + ' 運航状況</b><span>公式ページ</span></a>';
        if (air && air[1]) lk += '<a class="linkbtn" href="https://www.flightaware.com/live/fleet/' + air[1] + '" target="_blank" rel="noopener"><b>' + esc(air[0]) + ' 全便の状況</b><span>FlightAware フリート</span></a>';
        if (route && route.origin && route.origin.iata_code) lk += '<a class="linkbtn" href="' + U.fr24AptDep(route.origin.iata_code) + '" target="_blank" rel="noopener"><b>' + esc(route.origin.iata_code) + ' 出発ボード</b><span>出発空港</span></a>';
        if (route && route.destination && route.destination.iata_code) lk += '<a class="linkbtn" href="' + U.fr24AptArr(route.destination.iata_code) + '" target="_blank" rel="noopener"><b>' + esc(route.destination.iata_code) + ' 到着ボード</b><span>到着空港</span></a>';
      }

      if (lk) html += '<div class="card"><h3>機材繰り・運航状況を開く</h3><div class="linkgrid" style="margin-top:4px">' + lk + '</div></div>';

      var label = (q.type === 'reg' || q.type === 'hex') ? (reg || acKey) : q.flight;
      html += '<div class="btnrow" style="margin-top:10px"><button class="btn violet wide" id="favAcBtn">' +
        esc(label || v) + ' をよく見る機体に登録</button></div>';

      host.innerHTML = html;
      var fb = $('#favAcBtn');
      if (fb) fb.onclick = function () { addFav(label); toast('登録しました'); };

      var slot = $('#histSlot');
      if (slot && (q.type === 'reg' || q.type === 'hex')) {
        slot._reg = reg || '';
        histLoad(slot, 'reg', reg || acKey, false);
      } else if (slot && q.type === 'flight') {
        histLoad(slot, 'flight', q.flight, false);
      }
    });
  }

  /* ---------- お気に入り機体の履歴一覧 ---------- */
  function renderFavHist() {
    var host = $('#acFavHist');
    if (!host) return;
    if (!state.favCrew.length) { host.innerHTML = ''; return; }
    var rows = '';
    state.favCrew.forEach(function (c) {
      var pq = parseQuery(c);
      var mode = (pq && pq.type === 'flight') ? 'flight' : 'reg';
      var cache = histGet(mode + ':' + c);
      var last = cache && cache.list && cache.list[0];
      var sub = '';
      if (last) {
        var p = jst(last.dep || last.arr);
        sub = '<span class="mono">' + esc(last.o) + '→' + esc(last.dst) + '</span> ' +
          esc(p ? p.md + ' ' + p.hm : '') +
          (mode === 'flight' && last.reg ? ' ・ <span class="mono">' + esc(last.reg) + '</span>' : '') +
          (mode === 'reg' && last.flt ? ' ・ <span class="mono">' + esc(last.flt) + '</span>' : '');
      } else {
        sub = (mode === 'flight') ? 'この便名の運航履歴を見る' : '飛行履歴を見る（直近7日）';
      }
      rows += '<button class="frow" data-q="' + esc(c) + '">' +
        '<span class="fq mono">' + esc(c) + '</span>' +
        '<span class="fs">' + sub + '</span>' +
        '<span class="go">›</span></button>';
    });
    host.innerHTML = '<div class="card"><div class="hist-h"><h3>お気に入りの飛行履歴</h3>' +
      '<span class="pill">' + state.favCrew.length + '件</span></div>' +
      '<div class="favlist">' + rows + '</div>' +
      '<p class="hist-note">タップすると、その機体・便の履歴（どこからどこへ飛んだか）を開きます。</p></div>';
    Array.prototype.forEach.call(host.querySelectorAll('.frow'), function (b) {
      b.onclick = function () {
        var qq = b.getAttribute('data-q');
        $('#acInput').value = qq;
        doAircraftSearch(qq);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });
  }

  function crossBoard(q) {
    var out = [];
    if (!state.board || !state.board.airports) return out;
    var qq = (q || '').toUpperCase();
    if (!qq) return out;
    ['HND', 'NRT', 'FUK'].forEach(function (iata) {
      var air = state.board.airports[iata];
      if (!air) return;
      Object.keys(air.boards).forEach(function (k) {
        var dir = k.indexOf('_dep') > 0 ? 'dep' : 'arr';
        air.boards[k].forEach(function (r) {
          if ((r[4] || '').toUpperCase().indexOf(qq) >= 0) {
            out.push({ iata: iata, dir: dir, time: r[0], dest: r[3] || r[2], gate: r[6], status: r[7], flt: cleanFlt(r[4]), scope: k.indexOf('int') === 0 ? 'int' : 'dom' });
          }
        });
      });
    });
    out.sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); });
    return out;
  }

  /* ---------------- リンク集 ---------------- */
  function renderLinks() {
    var host = $('#linkArea');
    var q = state.linkFilter.trim().toLowerCase();
    var html = '';

    // ライブ対応空港
    var liveApts = state.board && state.board.airports ? Object.keys(state.board.airports) : [];
    if (liveApts.length) {
      html += '<div class="sec-title">ライブ自動取得（ボード表示）</div>';
      liveApts.forEach(function (iata) {
        var a = state.board.airports[iata];
        html += linkRow(iata, a.name, '自動更新 ・ ' + esc(a.src), 'https://yokomizomasaharu-sketch.github.io/flight-ops/', true);
      });
    }

    if (!q || '航空会社'.indexOf(q) >= 0 || 'airline'.indexOf(q) >= 0) {
      html += '<div class="sec-title">航空会社 運航状況（' + window.FO_AIRLINES.length + '社）</div>';
      window.FO_AIRLINES.forEach(function (a) {
        var url = a[5] || ('https://www.flightaware.com/live/fleet/' + a[1]);
        html += linkRow(a[0], a[2], a[3] + ' ・ ' + (a[5] ? '公式 運航状況' : 'FlightAware フリート'), url, true);
      });
    }

    var apts = window.FO_AIRPORT_LINKS;
    html += '<div class="sec-title">空港 公式フライト情報（' + apts.length + '）</div>';
    apts.forEach(function (a) {
      var url = a[2] || U.fr24AptDep(a[0]);
      html += linkRow(a[0], a[1], a[2] ? '公式フライト情報' : 'Flightradar24 ボード', url, true);
    });

    html += '<div class="sec-title">ツール</div>';
    window.FO_TOOLS.forEach(function (t) {
      html += linkRow('', t[0], t[1], t[2], true);
    });

    host.innerHTML = html;
    if (q) {
      Array.prototype.forEach.call(host.querySelectorAll('.lrow'), function (r) {
        if (r.textContent.toLowerCase().indexOf(q) < 0) r.style.display = 'none';
      });
    }
  }

  function linkRow(code, name, sub, url, ext) {
    return '<a class="lrow" href="' + url + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' +
      '<span class="code">' + esc(code) + '</span>' +
      '<span class="nm">' + esc(name) + '<small>' + sub + '</small></span>' +
      '<span class="go">›</span></a>';
  }

  /* ---------------- タブ ---------------- */
  function switchTab(v) {
    Array.prototype.forEach.call(document.querySelectorAll('nav.tabbar button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-view') === v);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.view'), function (s) {
      s.classList.toggle('active', s.id === 'view-' + v);
    });
    var stamp = $('#boardStamp');
    if (v === 'board') { stamp.classList.remove('hidden'); renderStamp(); }
    else {
      stamp.classList.add('hidden');
      if (v === 'aircraft') setLive('ok', 'ADS-B');
      if (v === 'links') setLive('link', 'HUB');
    }
    if (v === 'links') renderLinks();
    if (v === 'aircraft') renderFavHist();
    if (v === 'aircraft' && !state.acQuery) {
      var i = $('#acInput');
      if (i && !i.value && state.favCrew.length === 0) i.placeholder = 'JA01XJ ・ NH985';
    }
    window.scrollTo(0, 0);
  }

  /* ---------------- 初期化 ---------------- */
  function init() {
    // 時計
    function tick() {
      var d = new Date();
      var j = new Date(d.getTime() + (d.getTimezoneOffset() + 540) * 60000);
      $('#clock').textContent = pad(j.getHours()) + ':' + pad(j.getMinutes()) + ':' + pad(j.getSeconds()) + ' JST';
    }
    tick(); setInterval(tick, 1000);

    // タブ
    Array.prototype.forEach.call(document.querySelectorAll('nav.tabbar button'), function (b) {
      b.onclick = function () { switchTab(b.getAttribute('data-view')); };
    });

    // セグメント
    Array.prototype.forEach.call(document.querySelectorAll('#segDir button'), function (b) {
      b.onclick = function () {
        state.dir = b.getAttribute('data-dir');
        Array.prototype.forEach.call(document.querySelectorAll('#segDir button'), function (x) {
          x.classList.toggle('on', x === b);
          x.classList.toggle('dep', x === b && state.dir === 'dep');
          x.classList.toggle('arr', x === b && state.dir === 'arr');
        });
        renderBoard();
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll('#segScope button'), function (b) {
      b.onclick = function () {
        state.scope = b.getAttribute('data-scope');
        Array.prototype.forEach.call(document.querySelectorAll('#segScope button'), function (x) {
          x.classList.toggle('on', x === b);
        });
        renderBoard();
      };
    });

    $('#fltFilter').oninput = function (e) { state.filter = e.target.value; renderBoard(); };

    // 機材運用
    $('#acGo').onclick = function () { doAircraftSearch($('#acInput').value); };
    $('#acInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('#acInput').blur(); doAircraftSearch($('#acInput').value); }
    });
    renderFavCrew();
    renderFavHist();

    // リンク集
    $('#linkFilter').oninput = function (e) { state.linkFilter = e.target.value; renderLinks(); };

    $('#btnRefresh').onclick = function () { loadBoard(true); };

    // 起動（前回の空港を復元）
    var last = load(LS.apt, '');
    if (last && APT_BY_IATA[last]) state.airport = last;
    renderChips();
    renderBoardHead();
    loadBoard(false);

    // 10分ごとに自動更新（アプリを開いている間）
    setInterval(function () { loadBoard(false); }, 10 * 60 * 1000);

    // 復帰時に再取得
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && state.board) {
        var t = state.board.generatedAt ? Date.parse(state.board.generatedAt) : 0;
        if (Date.now() - t > 8 * 60 * 1000) loadBoard(false);
      }
    });

    // URL ハッシュで空港指定（#KIX など）
    var h = (location.hash || '').replace('#', '').toUpperCase();
    if (h && APT_BY_IATA[h]) setAirport(h);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
