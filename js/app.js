/* brain-hack — vanilla JS PWA. Data: data/index.json, data/config.json, data/YYYY-MM-DD.json */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var app = $('#app');

  /* ---------- storage ---------- */
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var user = LS.get('bh.user.v1', { stars: {}, status: {} });
  user.stars = user.stars || {}; user.status = user.status || {};
  var lastSeenAtLoad = LS.get('bh.lastSeen', null);
  var saveUser = function () { LS.set('bh.user.v1', user); };

  /* ---------- state ---------- */
  var S = { cfg: null, index: null, days: {}, ideas: [], trends: [], w: {}, openIds: {}, offline: false, youth: null, tools: null, toolMap: {} };
  var F = { cat: '', type: '', cap: '', eff: '', st: '', reg: '', tool: '', sort: 'total', q: '' };
  var KF = { reg: '', th: '' };

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : '#'; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function todaySaigon() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { var d = new Date(Date.now() + 7 * 3600e3); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  }
  var WD = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  function parts(ds) { var p = ds.split('-'); return { y: +p[0], m: +p[1], d: +p[2], wd: new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay() }; }
  function dmy(ds) { if (!ds) return '—'; if (/^\d{4}-\d{2}$/.test(ds)) { var q = ds.split('-'); return q[1] + '/' + q[0]; } var p = parts(ds); return pad(p.d) + '/' + pad(p.m) + '/' + p.y; }
  function longDate(ds) { var p = parts(ds); return WD[p.wd] + ', ' + pad(p.d) + '/' + pad(p.m) + '/' + p.y; }
  function fmtNum(n) { return String(n).replace('.', ','); }
  function total(sc) { var t = 0; for (var k in S.w) t += (sc[k] || 0) * S.w[k]; return Math.round(t * 100) / 100; }
  function capLabel(c) {
    var v = function (x) { return fmtNum(x); };
    var vnd = c.vnd_max_m === 0 ? '0' : v(c.vnd_min_m) + '–' + v(c.vnd_max_m) + ' triệu';
    var usd = c.usd_max === 0 ? '$0' : '≈ $' + c.usd_min.toLocaleString('vi-VN') + '–' + c.usd_max.toLocaleString('vi-VN');
    return vnd + ' VND (' + usd + ')';
  }
  function tierOf(c) { var t = S.cfg.capital_tiers; for (var i = 0; i < t.length; i++) if (t[i].max_m == null || c.vnd_max_m <= t[i].max_m) return t[i]; return t[t.length - 1]; }
  function effOf(ease) { var e = S.cfg.effort_levels; for (var i = 0; i < e.length; i++) if (ease >= e[i].min_ease) return e[i]; return e[e.length - 1]; }
  function catLabel(id) { var c = S.cfg.categories.filter(function (x) { return x.id === id; })[0]; return c ? c.label : id; }
  function regInfo(id) { var r = S.cfg.regions.filter(function (x) { return x.id === id; })[0]; return r || { id: id, label: id, flag: '' }; }
  function regChips(list) { return (list || []).map(function (r) { var x = regInfo(r); return '<span class="tag reg" title="' + esc(x.label) + '">' + esc(x.flag) + ' ' + esc(r) + '</span>'; }).join(''); }
  function typeLabel(id) { var c = S.cfg.types.filter(function (x) { return x.id === id; })[0]; return c ? c.label : id; }
  var STATUS = [{ id: 'interested', label: 'Quan tâm' }, { id: 'testing', label: 'Đang thử' }, { id: 'skipped', label: 'Bỏ qua' }];
  function toast(msg, action, cb) {
    var t = $('#toast'); t.innerHTML = '<span>' + esc(msg) + '</span>';
    if (action) { var b = document.createElement('button'); b.textContent = action; b.onclick = function () { t.hidden = true; cb && cb(); }; t.appendChild(b); }
    t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, action ? 12000 : 2600);
  }

  /* ---------- data ---------- */
  function fetchJSON(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
  function load() {
    return Promise.all([fetchJSON('data/config.json'), fetchJSON('data/index.json'), fetchJSON('data/vn-youth.json').catch(function () { return null; }), fetchJSON('data/tools.json').catch(function () { return null; })]).then(function (a) {
      S.cfg = a[0]; S.index = a[1]; S.youth = a[2]; S.tools = a[3]; if (S.tools) S.tools.tools.forEach(function (t) { S.toolMap[t.id] = t; }); S.cfg.criteria.forEach(function (c) { S.w[c.key] = c.weight; });
      return Promise.all(S.index.days.map(function (d) { return fetchJSON('data/' + d.file).then(function (j) { S.days[d.date] = j; }); }));
    }).then(function () {
      S.ideas = []; S.trends = [];
      Object.keys(S.days).sort().reverse().forEach(function (dt) {
        var day = S.days[dt];
        (day.ideas || []).forEach(function (i) { i._date = dt; i._total = total(i.scores); i._tier = tierOf(i.capital); i._eff = effOf(i.scores.ease); S.ideas.push(i); });
        (day.trends || []).forEach(function (t) { S.trends.push(t); });
      });
      var sorted = S.ideas.slice().sort(cmpTotal);
      sorted.forEach(function (i, n) { i._overall = n + 1; });
    });
  }
  function cmpTotal(a, b) { return (b._total - a._total) || (b.scores.signal - a.scores.signal) || (b.scores.demand - a.scores.demand) || (a.id < b.id ? -1 : 1); }

  /* ---------- filtering ---------- */
  function match(i) {
    if (F.cat && i.category.indexOf(F.cat) < 0) return false;
    if (F.type && i.type !== F.type) return false;
    if (F.reg && (i.regions || []).indexOf(F.reg) < 0) return false;
    if (F.tool && ideaToolIds(i).indexOf(F.tool) < 0) return false;
    if (F.cap && i._tier.id !== F.cap) return false;
    if (F.eff && i._eff.id !== F.eff) return false;
    if (F.st) {
      var s = user.status[i.id];
      if (F.st === 'star' && !user.stars[i.id]) return false;
      else if (F.st === 'none' && s) return false;
      else if (F.st !== 'star' && F.st !== 'none' && s !== F.st) return false;
    }
    if (F.q) {
      var hay = [i.title, i.pitch, (i.tags || []).join(' '), i.signal_text, i.localize_vn, i.vn_youth_fit, (i.regions || []).join(' '), toolNames(i), (i.sources || []).map(function (s) { return s.name + ' ' + s.title; }).join(' ')].join(' ').toLowerCase();
      var terms = F.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var k = 0; k < terms.length; k++) if (hay.indexOf(terms[k]) < 0) return false;
    }
    return true;
  }
  function sortList(list) {
    var by = F.sort, c;
    if (by === 'total') c = cmpTotal;
    else if (by === 'new') c = function (a, b) { return (a.date < b.date ? 1 : a.date > b.date ? -1 : cmpTotal(a, b)); };
    else if (by === 'lowcap') c = function (a, b) { return (a.capital.vnd_max_m - b.capital.vnd_max_m) || cmpTotal(a, b); };
    else if (by === 'ease') c = function (a, b) { return (b.scores.ease - a.scores.ease) || cmpTotal(a, b); };
    else if (by === 'signal') c = function (a, b) { return (b.scores.signal - a.scores.signal) || cmpTotal(a, b); };
    else if (by === 'vnfit') c = function (a, b) { return (b.scores.vnfit - a.scores.vnfit) || cmpTotal(a, b); };
    else c = cmpTotal;
    return list.slice().sort(c);
  }
  function hasFilter() { return !!(F.cat || F.type || F.cap || F.eff || F.st || F.reg || F.tool || F.q); }
  function toolName(id) { var t = S.toolMap[id]; return t ? t.name : id; }
  function ideaToolIds(i) { return i.toolstack ? i.toolstack.tools.map(function (x) { return x.tool_id; }) : []; }
  function toolNames(i) { if (!i.toolstack) return ''; var a = []; i.toolstack.tools.forEach(function (x) { a.push(toolName(x.tool_id)); (x.alt_ids || []).forEach(function (k) { a.push(toolName(k)); }); }); return a.join(' '); }
  function toolUse() {
    var o = {}; S.ideas.forEach(function (i) { ideaToolIds(i).forEach(function (k) { o[k] = (o[k] || 0) + 1; }); }); return o;
  }

  /* ---------- components ---------- */
  function filterBar(extraNote) {
    var cfg = S.cfg;
    var chips = function (key, items, all) {
      return '<button type="button" class="chip" data-f="' + key + '" data-v="" aria-pressed="' + (F[key] === '') + '">' + all + '</button>' +
        items.map(function (x) { return '<button type="button" class="chip" data-f="' + key + '" data-v="' + esc(x.id) + '" aria-pressed="' + (F[key] === x.id) + '">' + esc(x.label) + '</button>'; }).join('');
    };
    var opts = function (key, items, all) { return '<select data-fs="' + key + '" aria-label="' + esc(all) + '"><option value="">' + esc(all) + '</option>' + items.map(function (x) { return '<option value="' + esc(x.id) + '"' + (F[key] === x.id ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select>'; };
    return '<details class="filters" id="filters"' + (hasFilter() ? ' open' : '') + '><summary><span>⚙ Bộ lọc &amp; sắp xếp</span><span class="count" id="fcount"></span></summary>' +
      '<div class="frow"><span class="lbl">Danh mục</span>' + chips('cat', cfg.categories, 'Tất cả') + '</div>' +
      '<div class="frow"><span class="lbl">Loại</span>' + chips('type', cfg.types, 'Tất cả') + '</div>' +
      '<div class="frow"><span class="lbl">Vùng tín hiệu</span>' + chips('reg', cfg.regions.map(function (r) { return { id: r.id, label: r.flag + ' ' + r.label }; }), 'Tất cả') + '</div>' +
      (S.tools ? '<div class="frow"><span class="lbl">Công cụ</span>' + toolSelect() + '</div>' : '') +
      '<div class="frow"><span class="lbl">Vốn / công sức</span>' + opts('cap', cfg.capital_tiers, 'Mọi mức vốn') + opts('eff', cfg.effort_levels, 'Mọi mức công sức') +
      '<select data-fs="st" aria-label="Trạng thái của tôi"><option value="">Mọi trạng thái</option><option value="star"' + (F.st === 'star' ? ' selected' : '') + '>★ Đã gắn sao</option>' +
      STATUS.map(function (s) { return '<option value="' + s.id + '"' + (F.st === s.id ? ' selected' : '') + '>' + s.label + '</option>'; }).join('') + '<option value="none"' + (F.st === 'none' ? ' selected' : '') + '>Chưa phân loại</option></select></div>' +
      '<div class="frow"><span class="lbl">Sắp xếp</span><select data-fs="sort" aria-label="Sắp xếp">' +
      [['total', 'Tổng điểm (cao → thấp)'], ['new', 'Mới nhất'], ['lowcap', 'Vốn thấp nhất'], ['ease', 'Dễ làm nhất'], ['signal', 'Tín hiệu quốc tế mạnh nhất'], ['vnfit', 'Hợp giới trẻ VN nhất']].map(function (o) { return '<option value="' + o[0] + '"' + (F.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      (hasFilter() ? '<button type="button" class="btn" id="fclear">Xóa bộ lọc</button>' : '') + '</div>' + (extraNote || '') + '</details>';
  }
  function toolSelect() {
    var use = toolUse(), ids = Object.keys(use).sort(function (a, b) { return use[b] - use[a] || (toolName(a) < toolName(b) ? -1 : 1); });
    return '<select data-fs="tool" aria-label="Lọc theo công cụ"><option value="">Mọi công cụ</option>' + ids.map(function (k) { return '<option value="' + esc(k) + '"' + (F.tool === k ? ' selected' : '') + '>' + esc(toolName(k)) + ' (' + use[k] + ')</option>'; }).join('') + '</select>';
  }
  function toolChips(i) {
    if (!i.toolstack) return '';
    return '<div class="toolrow" aria-label="Công cụ đề xuất"><span class="lbl">🧰 Bộ công cụ</span>' + i.toolstack.tools.map(function (x) {
      var t = S.toolMap[x.tool_id]; return '<button type="button" class="chip small tchip" data-tool="' + esc(x.tool_id) + '" title="' + esc(x.role) + ' — bấm để lọc ý tưởng dùng công cụ này">' + esc(t ? t.name.replace(/\s*\(.*\)$/, '') : x.tool_id) + '</button>';
    }).join('') + '</div>';
  }
  function vnBadge(t) {
    var c = t.vn_availability === 'đã xác minh' ? 'v2' : t.vn_availability === 'có hạn chế' ? 'v1' : 'vu';
    return '<span class="vb ' + c + '" title="' + esc(t.vn_note || '') + '">VN: ' + esc(t.vn_availability) + '</span>';
  }
  function factBadge(v) { var c = v === '2+ nguồn độc lập' ? 'v2' : v === '1 nguồn gốc' ? 'v1' : 'vu'; return '<span class="vb ' + c + '">' + esc(v) + '</span>'; }
  function variantBox(title, cls, v) {
    return '<div class="variant ' + cls + '"><b>' + title + '</b><div class="vt">' + v.tool_ids.map(function (k) { return '<a class="chip small" href="#/cong-cu/' + esc(k) + '">' + esc(toolName(k).replace(/\s*\(.*\)$/, '')) + '</a>'; }).join(' ') + '</div>' +
      '<p class="small"><b>Chi phí ước tính:</b> ' + esc(v.monthly_cost_note) + '</p><p class="small muted"><b>Đánh đổi:</b> ' + esc(v.tradeoff) + '</p></div>';
  }
  function toolstackBlock(i) {
    var ts = i.toolstack; if (!ts || !S.tools) return '';
    var h = '<h4 class="sub">🧰 Bộ công cụ đề xuất <span class="muted small">kiểm lần cuối ' + dmy(ts.checked) + ' · độ tin cậy: ' + esc(ts.confidence) + '</span></h4>' +
      '<div class="box wow">✨ <b>Wow:</b> ' + esc(ts.wow) + '</div><ol class="tools">';
    ts.tools.forEach(function (x) {
      var t = S.toolMap[x.tool_id]; if (!t) return;
      var f = t.facts[0];
      var alts = (x.alt_ids || []).map(function (k) { return '<a href="#/cong-cu/' + esc(k) + '">' + esc(toolName(k).replace(/\s*\(.*\)$/, '')) + '</a>'; }).join(', ');
      h += '<li class="tl"><div class="th"><b>' + esc(t.name) + '</b> ' + vnBadge(t) + '</div>' +
        '<div class="small"><b>Vai trò:</b> ' + esc(x.role) + '</div><div class="small"><b>Vì sao hợp:</b> ' + esc(x.why) + '</div>' +
        (alts ? '<div class="small muted"><b>Thay thế:</b> ' + alts + (x.alt_note ? ' — ' + esc(x.alt_note) : '') + '</div>' : '') +
        (f ? '<div class="small tp">' + factBadge(f.verification) + esc(f.text) + (t.facts.length > 1 ? ' <a href="#/cong-cu/' + esc(t.id) + '">+' + (t.facts.length - 1) + ' dữ kiện khác</a>' : '') + '</div>' : '') +
        '<div class="small muted">kiểm ' + dmy(t.checked) + ' · <a href="' + esc(safeUrl(t.url)) + '" target="_blank" rel="noopener noreferrer">trang chính thức ↗</a>' + (t.pricing_url && t.pricing_url !== t.url ? ' · <a href="' + esc(safeUrl(t.pricing_url)) + '" target="_blank" rel="noopener noreferrer">trang giá ↗</a>' : '') + '</div></li>';
    });
    h += '</ol><div class="variants">' + variantBox('💸 Bản tiết kiệm', 'budget', ts.budget) + variantBox('💎 Bản cao cấp', 'premium', ts.premium) + '</div>' +
      '<p class="small muted">Giá niêm yết USD/€ theo trang chính thức, chưa gồm thuế; thay đổi theo tuần. Công cụ ghi “chưa xác minh” = chưa mở/đọc được trang nên không nêu giá. Bản miễn phí có thể không cho dùng thương mại — xem điều khoản.</p>';
    return h;
  }
  function bars(sc, compact) {
    var cfg = S.cfg.criteria;
    if (compact) return '<div class="minibars" aria-label="Điểm thành phần">' + cfg.map(function (c) {
      return '<div class="mb" title="' + esc(c.label) + ' (trọng số ' + Math.round(c.weight * 100) + '%)"><strong>' + sc[c.key] + '</strong><div class="bar"><i style="width:' + sc[c.key] * 10 + '%"></i></div>' + esc(c.short || c.label) + '</div>';
    }).join('') + '</div>';
    return '<div class="detailbars">' + cfg.map(function (c) {
      return '<div class="row"><span>' + esc(c.label) + ' <span class="muted">(×' + fmtNum(c.weight) + ')</span></span><div class="bar"><i style="width:' + sc[c.key] * 10 + '%"></i></div><b>' + sc[c.key] + '/10</b></div>';
    }).join('') + '</div>';
  }
  function factList(facts, sources, pref) {
    var idx = {}; sources.forEach(function (s, n) { idx[s.id] = n + 1; });
    return '<ul class="facts">' + facts.map(function (f) {
      var cls = f.verification === '2+ nguồn độc lập' ? 'v2' : f.verification === '1 nguồn gốc' ? 'v1' : 'vu';
      var refs = (f.source_ids || []).map(function (id) { return '<sup><a href="#' + esc(pref + id) + '" data-src="' + esc(pref + id) + '">[' + (idx[id] || '?') + ']</a></sup>'; }).join('');
      return '<li' + (f.id && pref.indexOf('ys-') === 0 ? ' id="yfact-' + esc(f.id) + '"' : '') + ' class="' + cls + '"><span class="vb ' + cls + '">' + esc(f.verification) + '</span>' + esc(f.text) + ' ' + refs + (f.note ? '<span class="note">Lưu ý: ' + esc(f.note) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function srcList(sources, pref) {
    return '<ol class="srcs">' + sources.map(function (s) {
      return '<li id="' + esc(pref + s.id) + '"><a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(s.name) + ' — ' + esc(s.title) + '</a>' +
        '<br><span class="m">đăng: ' + (s.published ? dmy(s.published) : 'không rõ') + ' · truy cập: ' + dmy(s.accessed) + ' · ' + esc(s.how_read) + (s.note ? ' · ' + esc(s.note) : '') + '</span></li>';
    }).join('') + '</ol>';
  }
  function youthRefs(i) {
    var facts = {}; if (S.youth) S.youth.sections.forEach(function (sc) { sc.facts.forEach(function (f) { facts[f.id] = f; }); });
    var h = (i.vn_fit_refs || []).filter(function (r) { return facts[r]; }).map(function (r) { return '<a class="chip small" href="#/gioi-tre/' + esc(r) + '">' + esc(facts[r].label) + '</a>'; }).join(' ');
    return h ? '<p class="small muted">Dữ kiện giới trẻ liên quan: ' + h + '</p>' : '';
  }
  function kwRefs(i) {
    var d = S.days[i._date]; if (!d || !d.keywords) return '';
    var rel = d.keywords.filter(function (k) { return (k.idea_ids || []).indexOf(i.id) >= 0; });
    var src = (i.from_keywords || []).map(function (id) { return d.keywords.filter(function (k) { return k.id === id; })[0]; }).filter(Boolean);
    var h = '';
    if (src.length) h += '<p class="small"><b>Sinh ra từ từ khóa hot:</b> ' + src.map(function (k) { return regInfo(k.region).flag + ' ' + esc(k.keyword); }).join(' · ') + ' — <a href="#/tu-khoa">xem tab Từ khóa hot</a></p>';
    if (rel.length) h += '<p class="small muted">Từ khóa hot liên quan: ' + rel.map(function (k) { return regInfo(k.region).flag + ' ' + esc(k.keyword); }).join(' · ') + '</p>';
    return h;
  }
  function promptBlock(i) {
    if (!i.claude_prompt) return '';
    return '<h4 class="sub">Triển khai: giao cho Claude làm</h4><div class="promptbox"><div class="ph"><b>🤖 Prompt cho Claude</b><span class="muted small">' + i.claude_prompt.length.toLocaleString('vi-VN') + ' ký tự</span><button type="button" class="btn primary copybig" data-act="copyprompt">📋 Copy prompt</button></div>' +
      '<p class="small muted">Dán nguyên văn vào Claude. Prompt chỉ dùng các dữ kiện có nguồn của ý tưởng này; phần áp dụng cho VN vẫn là giả thuyết cần test.</p>' +
      '<pre class="prompt" tabindex="0">' + esc(i.claude_prompt) + '</pre></div>';
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta); ok ? res() : rej(new Error('copy failed'));
    });
  }
  function ideaCard(i, o) {
    o = o || {};
    var st = user.status[i.id] || '', starred = !!user.stars[i.id];
    var isNew = lastSeenAtLoad == null || i.date > lastSeenAtLoad;
    var rk = o.overall ? i._overall : i.rank;
    var rcls = rk <= 3 ? ' r' + rk : '';
    var open = S.openIds[i.id] ? ' open' : '';
    var h = '<article class="card' + (st === 'skipped' ? ' skipped' : '') + '" id="idea-' + esc(i.id) + '" data-id="' + esc(i.id) + '">' +
      '<div class="top"><div class="rank' + rcls + '" title="' + (o.overall ? 'Hạng toàn thời gian' : 'Hạng trong ngày') + '">#' + rk + '</div>' +
      '<div style="min-width:0;flex:1"><h3>' + esc(i.title) + '</h3><div class="tags">' +
      (isNew ? '<span class="badge new">Mới</span>' : '') + (i.hypothesis ? '<span class="badge hyp" title="' + esc(i.hypothesis_note) + '">Giả thuyết</span>' : '') +
      '<span class="tag' + (i.type === 'invest' ? ' type-invest' : '') + '">' + esc(typeLabel(i.type)) + '</span>' + regChips(i.regions) +
      i.category.map(function (c) { return '<span class="tag">' + esc(catLabel(c)) + '</span>'; }).join('') + '</div></div>' +
      '<div class="score" title="Tổng điểm có trọng số (thang 10)"><b>' + fmtNum(i._total.toFixed(2)) + '</b><span>/ 10</span></div></div>' +
      '<div class="pitchrow">' + (i.image ? '<img class="thumb" src="' + esc(i.image) + '" alt="' + esc(i.image_alt || i.title) + '" loading="lazy" decoding="async" width="128" height="96">' : '') + '<p class="pitch">' + esc(i.pitch) + '</p></div>' + toolChips(i) + bars(i.scores, true) +
      '<div class="meta"><span>💰 <b>' + esc(capLabel(i.capital)) + '</b></span><span>🛠 ' + esc(i._eff.label) + '</span><span>📅 ' + dmy(i.date) + '</span><span>Độ tin cậy: <b>' + esc(i.confidence) + '</b></span></div>' +
      '<div class="acts"><button class="btn star" data-act="star" aria-pressed="' + starred + '" aria-label="Gắn sao" title="Gắn sao">' + (starred ? '★' : '☆') + '</button>' +
      STATUS.map(function (s) { return '<button class="btn st s-' + s.id + '" data-act="st" data-v="' + s.id + '" aria-pressed="' + (st === s.id) + '">' + s.label + '</button>'; }).join('') +
      '<span class="grow"></span><button class="btn primary small" data-act="copyprompt" title="Sao chép prompt để dán vào Claude">🤖 Copy prompt</button><button class="btn ghost small" data-act="link" title="Sao chép liên kết">🔗</button></div>' +
      '<details class="more" data-id="' + esc(i.id) + '"' + open + '><summary>Chi tiết, nguồn &amp; 7 ngày thử đầu tiên</summary>' +
      (i.image ? '<figure class="hero-img"><img src="' + esc(i.image) + '" alt="' + esc(i.image_alt || i.title) + '" loading="lazy" decoding="async" width="800" height="600"><figcaption>Minh họa ý tưởng (ảnh do AI tạo, chỉ để hình dung)</figcaption></figure>' : '') +
      (i.hypothesis ? '<div class="box hypbox"><b>Giả thuyết:</b> ' + esc(i.hypothesis_note) + '</div>' : '') +
      '<h4 class="sub">Tín hiệu quốc tế (vì sao bây giờ) ' + regChips(i.regions) + '</h4><p>' + esc(i.signal_text) + '</p>' + factList(i.key_facts, i.sources, 'src-' + i.id + '-') +
      '<h4 class="sub">Phù hợp hành vi giới trẻ VN (điểm ' + i.scores.vnfit + '/10)</h4><p>' + esc(i.vn_youth_fit) + '</p>' + youthRefs(i) + kwRefs(i) +
      '<h4 class="sub">Việt hóa</h4><p>' + esc(i.localize_vn) + '</p>' + (i.localize_global ? '<h4 class="sub">Toàn cầu</h4><p>' + esc(i.localize_global) + '</p>' : '') +
      '<h4 class="sub">Thử trong 1 tuần</h4><ol class="steps">' + i.first_steps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' +
      toolstackBlock(i) + promptBlock(i) +
      '<h4 class="sub">Vốn ước tính</h4><p><b>' + esc(capLabel(i.capital)) + '</b><br><span class="muted small">' + esc(i.capital.note) + '</span></p>' +
      '<h4 class="sub">Rủi ro</h4><ul class="risks">' + i.risks.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<h4 class="sub">Điểm chi tiết (tổng = Σ điểm × trọng số)</h4>' + bars(i.scores, false) +
      '<h4 class="sub">Nguồn đã mở (' + i.sources.length + ')</h4>' + srcList(i.sources, 'src-' + i.id + '-') + '</details></article>';
    return h;
  }
  function trendCard(t, n) {
    return '<article class="card trend" id="trend-' + esc(t.id) + '"><h3><span class="n">' + n + '</span>' + esc(t.title) + '</h3><div class="tags">' + regChips(t.regions) + '</div><p>' + esc(t.summary) + '</p>' +
      '<p class="why">💡 ' + esc(t.why_it_matters) + '</p>' +
      '<details class="more" data-id="' + esc(t.id) + '"' + (S.openIds[t.id] ? ' open' : '') + '><summary>Dữ kiện &amp; nguồn (' + t.sources.length + ')</summary>' + factList(t.key_facts, t.sources, 'tsrc-' + t.id + '-') + srcList(t.sources, 'tsrc-' + t.id + '-') + '</details></article>';
  }
  function listIdeas(list, o) {
    if (!list.length) return '<div class="empty">Không có ý tưởng nào khớp bộ lọc. <button class="btn" id="fclear2">Xóa bộ lọc</button></div>';
    return '<div class="grid cols2">' + list.map(function (i) { return ideaCard(i, o); }).join('') + '</div>';
  }

  /* ---------- views ---------- */
  function regionsOf(day) { var o = {}; (day.trends || []).forEach(function (t) { (t.regions || []).forEach(function (r) { o[r] = 1; }); }); return Object.keys(o); }
  function trendsHtml(day) {
    var list = (day.trends || []).filter(function (t) { return !F.reg || (t.regions || []).indexOf(F.reg) >= 0; });
    list = list.slice().sort(function (a, b) { var ac = (a.regions || []).indexOf('CN') >= 0 ? 0 : 1, bc = (b.regions || []).indexOf('CN') >= 0 ? 0 : 1; return ac - bc; });
    if (!list.length) return '<div class="empty small">Không có tín hiệu nào ở vùng này hôm nay.</div>';
    return '<div class="grid cols2">' + list.map(function (t, n) { return trendCard(t, n + 1); }).join('') + '</div>';
  }
  function viewDay(dt, isToday) {
    var day = S.days[dt];
    if (!day) return '<div class="empty">Không tìm thấy dữ liệu ngày ' + esc(dt) + '. <a href="#/luu-tru">Xem lưu trữ</a></div>';
    var today = todaySaigon(), latest = S.index.latest, fresh = dt === today;
    var badge = fresh ? '<span class="badge new">Mới hôm nay</span>' : '<span class="badge stale">Bản ngày ' + dmy(dt) + '</span>';
    var banner = (isToday && latest !== today) ? '<div class="banner">Chưa có bản cập nhật cho hôm nay (' + dmy(today) + '). Đang hiển thị bản mới nhất: <b>' + dmy(latest) + '</b>.</div>' : '';
    var ideas = sortList(day.ideas.filter(match));
    var top = day.ideas.slice().sort(cmpTotal)[0];
    var h = banner + '<section class="hero"><div class="date">' + badge + '<span>' + (isToday ? 'Hôm nay' : 'Lưu trữ') + '</span></div><div class="bigdate">' + longDate(dt) + '</div>' +
      '<p><b>' + esc(day.headline) + '</b></p><p>' + esc(day.summary) + '</p>' +
      '<div class="stats"><span class="stat">' + day.ideas.length + ' ý tưởng</span><span class="stat">' + day.trends.length + ' tín hiệu · ' + regionsOf(day).length + ' vùng</span>' + (day.keywords ? '<span class="stat">' + day.keywords.length + ' từ khóa hot</span>' : '') +
      (top ? '<span class="stat">Top 1: ' + fmtNum(top._total.toFixed(2)) + '/10</span>' : '') + '</div></section>';
    h += '<div class="sec"><h2>🌏 Xu hướng thế giới ' + (fresh ? 'hôm nay' : 'ngày ' + dmy(dt)) + '</h2><span class="muted small">Trung Quốc là trọng tâm · mỗi dữ kiện ghi mức xác minh &amp; nguồn đã mở</span></div>';
    h += '<div id="trends">' + trendsHtml(day) + '</div>';
    h += '<div class="sec"><h2>💡 Ý tưởng xếp hạng ' + (fresh ? 'hôm nay' : 'ngày ' + dmy(dt)) + '</h2><span class="muted small" id="rescount">' + ideas.length + '/' + day.ideas.length + ' ý tưởng</span></div>';
    h += filterBar() + '<div id="list">' + listIdeas(ideas) + '</div>';
    return h;
  }
  function viewBoard() {
    var list = sortList(S.ideas.filter(match));
    return '<div class="sec"><h1>🏆 Bảng xếp hạng toàn thời gian</h1><span class="muted small" id="rescount">' + list.length + '/' + S.ideas.length + ' ý tưởng từ ' + S.index.days.length + ' ngày</span></div>' +
      '<p class="muted">Xếp theo tổng điểm có trọng số; hạng #n là hạng trên toàn bộ các ngày (không phụ thuộc bộ lọc).</p>' + filterBar() + '<div id="list">' + listIdeas(list, { overall: true }) + '</div>';
  }
  function viewArchive() {
    return '<div class="sec"><h1>🗓 Lưu trữ theo ngày</h1><span class="muted small">' + S.index.days.length + ' ngày</span></div><div class="daylist">' +
      S.index.days.map(function (d) {
        var p = parts(d.date);
        return '<a class="dayrow" href="#/luu-tru/' + d.date + '"><div class="d"><b>' + pad(p.d) + '</b><span>Th' + pad(p.m) + '/' + p.y + '</span></div><div style="flex:1;min-width:0"><b>' + esc(longDate(d.date)) + '</b><br><span class="muted small">' + esc(d.headline) + '</span><br><span class="small">' + d.idea_count + ' ý tưởng · ' + d.trend_count + ' xu hướng' + (d.top ? ' · Top 1: ' + esc(d.top.title) + ' (' + fmtNum(Number(d.top.total_score).toFixed(2)) + ')' : '') + '</span></div></a>';
      }).join('') + '</div>';
  }
  function viewKeywords(dt) {
    dt = (dt && S.days[dt]) ? dt : S.index.latest; var day = S.days[dt];
    if (!day || !day.keywords) return '<div class="empty">Chưa có dữ liệu từ khóa cho ngày này.</div>';
    var kws = day.keywords, srcs = {}; (day.keyword_sources || []).forEach(function (x) { srcs[x.id] = x; });
    var regs = S.cfg.regions.filter(function (r) { return kws.some(function (k) { return k.region === r.id; }); });
    var ths = S.cfg.keyword_themes.filter(function (t) { return kws.some(function (k) { return k.theme === t.id; }); });
    var chips = function (key, items, all) { return '<button type="button" class="chip" data-kf="' + key + '" data-v="" aria-pressed="' + (KF[key] === '') + '">' + all + '</button>' + items.map(function (x) { return '<button type="button" class="chip" data-kf="' + key + '" data-v="' + esc(x.id) + '" aria-pressed="' + (KF[key] === x.id) + '">' + esc(x.label) + '</button>'; }).join(''); };
    var h = '<div class="sec"><h1>🔥 Từ khóa &amp; chủ đề hot</h1><span class="muted small">' + longDate(dt) + '</span></div>' +
      '<p class="muted">Từ khóa/chủ đề đang nổi theo vùng, nhóm theo chủ đề. Mỗi mục ghi <b>hạng, nguồn, giờ chụp (UTC+7) và độ tin cậy</b>; chủ đề có tiềm năng thương mại được nối tới ý tưởng. Bảng tìm kiếm thường nghiêng về thể thao/tin nóng nên nhiều từ khóa không gắn ý tưởng — đó là có chủ đích.</p>' +
      '<div class="filters kwf"><div class="frow"><span class="lbl">Vùng</span>' + chips('reg', regs.map(function (r) { return { id: r.id, label: r.flag + ' ' + r.label }; }), 'Tất cả') + '</div>' +
      '<div class="frow"><span class="lbl">Chủ đề</span>' + chips('th', ths.map(function (t) { return { id: t.id, label: t.icon + ' ' + t.label }; }), 'Tất cả') + '</div></div>';
    var q = (F.q || '').toLowerCase();
    var list = kws.filter(function (k) { return (!KF.reg || k.region === KF.reg) && (!KF.th || k.theme === KF.th) && (!q || (k.keyword + ' ' + (k.gloss || '') + ' ' + (k.metric || '')).toLowerCase().indexOf(q) >= 0); });
    h += '<p class="muted small" id="kwcount">' + list.length + '/' + kws.length + ' từ khóa</p>';
    if (!list.length) h += '<div class="empty">Không có từ khóa khớp bộ lọc.</div>';
    ths.forEach(function (t) {
      var items = list.filter(function (k) { return k.theme === t.id; }); if (!items.length) return;
      var rs = {}; items.forEach(function (k) { rs[k.region] = 1; });
      items.sort(function (a, b) { return (a.region < b.region ? -1 : a.region > b.region ? 1 : ((a.rank || 999) - (b.rank || 999))); });
      h += '<section class="kwtheme"><h2>' + t.icon + ' ' + esc(t.label) + ' <span class="muted small">' + items.length + ' từ khóa · ' + Object.keys(rs).map(function (r) { return regInfo(r).flag; }).join(' ') + '</span></h2><ul class="kwlist">' +
        items.map(function (k) {
          var s = srcs[k.source_id];
          var links = (k.idea_ids || []).map(function (id) { var it = S.ideas.filter(function (x) { return x.id === id; })[0]; return it ? '<a class="chip small" href="#/y-tuong/' + esc(id) + '">💡 #' + it._overall + ' ' + esc(it.title.split(/[—:(“]/)[0].trim().slice(0, 38)) + '</a>' : ''; }).join(' ');
          var cc = k.confidence.indexOf('gốc') >= 0 ? 'v2' : k.confidence.indexOf('chưa') >= 0 ? 'vu' : 'v1';
          return '<li><div class="kwh"><span class="rk">' + (k.rank ? '#' + k.rank : '·') + '</span><span class="tag reg">' + esc(regInfo(k.region).flag) + ' ' + esc(k.region) + '</span><b class="kwt">' + esc(k.keyword) + '</b><span class="vb ' + cc + '">' + esc(k.confidence) + '</span></div>' +
            (k.gloss ? '<div class="small">' + esc(k.gloss) + '</div>' : '') + (k.metric ? '<div class="small muted">' + esc(k.metric) + '</div>' : '') +
            (s ? '<div class="small muted">Nguồn: <a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(s.name) + '</a> · chụp ' + esc(String(s.captured_at).replace('T', ' ').slice(0, 16)) + ' (UTC+7) · truy cập ' + dmy(s.accessed) + '</div>' : ((k.derived_from || []).length ? '<div class="small muted">Suy ra từ ' + k.derived_from.length + ' từ khóa ở các vùng khác (lọc từng vùng để xem)</div>' : '')) +
            (k.note ? '<div class="note">Lưu ý: ' + esc(k.note) + '</div>' : '') + (links ? '<div class="kwl">' + links + '</div>' : '') + '</li>';
        }).join('') + '</ul></section>';
    });
    h += '<details class="more"><summary>Nguồn dữ liệu từ khóa (' + (day.keyword_sources || []).length + ')</summary><ol class="srcs">' + (day.keyword_sources || []).map(function (s) { return '<li><a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(s.name) + ' — ' + esc(s.title) + '</a><br><span class="m">chụp ' + esc(String(s.captured_at).replace('T', ' ').slice(0, 16)) + ' (UTC+7) · ' + esc(s.how_read) + (s.note ? ' · ' + esc(s.note) : '') + '</span></li>'; }).join('') + '</ol></details>';
    if ((day.keyword_unreachable || []).length) h += '<div class="box"><b>Nguồn không truy cập/không lấy được (không bịa số liệu):</b><ul>' + day.keyword_unreachable.map(function (u) { return '<li><b>' + esc(regInfo(u.region).flag + ' ' + u.source) + '</b> — ' + esc(u.reason) + '</li>'; }).join('') + '</ul></div>';
    return h;
  }
  function viewTools(focus) {
    var T = S.tools; if (!T) return '<div class="empty">Chưa có dữ liệu công cụ.</div>';
    var use = toolUse(), q = (F.q || '').toLowerCase();
    var h = '<div class="sec"><h1>🧰 Công cụ AI &amp; vận hành</h1><span class="muted small">kiểm lần cuối ' + dmy(T.verified_at) + ' · kiểm lại trước ' + dmy(T.next_review) + '</span></div>' +
      '<div class="box"><b>Cách đọc</b><ul>' + T.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>';
    T.categories.forEach(function (c) {
      var items = T.tools.filter(function (t) { return t.category === c.id && (!q || (t.name + ' ' + t.summary + ' ' + t.facts.map(function (f) { return f.text; }).join(' ')).toLowerCase().indexOf(q) >= 0); });
      if (!items.length) return;
      h += '<section class="kwtheme"><h2>' + esc(c.label) + ' <span class="muted small">' + items.length + ' công cụ</span></h2><div class="grid cols2">' + items.map(function (t) {
        return '<article class="card toolcard" id="tool-' + esc(t.id) + '"><h3>' + esc(t.name) + ' ' + vnBadge(t) + '</h3><p class="small">' + esc(t.summary) + '</p>' +
          '<ul class="facts">' + t.facts.map(function (f) { return '<li class="' + (f.verification === '2+ nguồn độc lập' ? 'v2' : f.verification === '1 nguồn gốc' ? 'v1' : 'vu') + '">' + factBadge(f.verification) + esc(f.text) + '</li>'; }).join('') + '</ul>' +
          '<p class="small muted">VN: ' + esc(t.vn_note || '') + '<br>Tiếng Việt: ' + esc(t.vi_support || 'chưa xác minh') + '<br>Cách đọc: ' + esc(t.how_read) + ' · kiểm ' + dmy(t.checked) + '</p>' +
          '<div class="acts"><a class="btn small" href="' + esc(safeUrl(t.url)) + '" target="_blank" rel="noopener noreferrer">Trang chính thức ↗</a>' + (t.pricing_url && t.pricing_url !== t.url ? '<a class="btn small" href="' + esc(safeUrl(t.pricing_url)) + '" target="_blank" rel="noopener noreferrer">Trang giá ↗</a>' : '') +
          '<span class="grow"></span>' + (use[t.id] ? '<button type="button" class="btn small primary" data-tool="' + esc(t.id) + '">💡 ' + use[t.id] + ' ý tưởng dùng</button>' : '<span class="muted small">chưa dùng trong ý tưởng nào</span>') + '</div></article>';
      }).join('') + '</div></section>';
    });
    return h;
  }
  function viewYouth() {
    var y = S.youth; if (!y) return '<div class="empty">Chưa có dữ liệu chân dung giới trẻ.</div>';
    var h = '<div class="sec"><h1>🧑‍🤝‍🧑 ' + esc(y.title) + '</h1><span class="muted small">kiểm lần cuối ' + dmy(y.verified_at) + ' · kiểm lại trước ' + dmy(y.next_review) + '</span></div>' +
      '<div class="box"><b>Tóm tắt</b><ul>' + y.summary_points.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><span class="small muted">' + esc(y.definition) + '</span></div>';
    y.sections.forEach(function (sc) {
      h += '<section class="kwtheme"><h2>' + sc.icon + ' ' + esc(sc.title) + '</h2>' + factList(sc.facts, sc.sources, 'ys-' + sc.id + '-') + '<details class="more" data-id="ys-' + esc(sc.id) + '"><summary>Nguồn (' + sc.sources.length + ')</summary>' + srcList(sc.sources, 'ys-' + sc.id + '-') + '</details></section>';
    });
    h += '<h2>Hàm ý cho ý tưởng</h2><ul>' + y.implications.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<h2>Hạn chế &amp; điểm chưa khớp</h2><ul class="risks">' + y.caveats.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    return h;
  }

  function viewSaved() {
    var all = S.ideas.filter(function (i) { return user.stars[i.id] || user.status[i.id]; });
    var list = sortList(all.filter(match));
    var cnt = function (s) { return all.filter(function (i) { return user.status[i.id] === s; }).length; };
    return '<div class="sec"><h1>★ Đã lưu</h1><span class="muted small" id="rescount">' + list.length + '/' + all.length + '</span></div>' +
      '<p class="muted">Lưu trên thiết bị này (localStorage): ★ ' + all.filter(function (i) { return user.stars[i.id]; }).length + ' · Quan tâm ' + cnt('interested') + ' · Đang thử ' + cnt('testing') + ' · Bỏ qua ' + cnt('skipped') + '.</p>' +
      '<p><button class="btn" id="exp">⬇ Sao lưu (JSON)</button> <button class="btn" id="imp">⬆ Khôi phục</button> <input type="file" id="impf" accept="application/json" hidden></p>' +
      filterBar() + '<div id="list">' + (all.length ? listIdeas(list, { overall: true }) : '<div class="empty">Chưa có gì được lưu. Bấm ☆ hoặc chọn “Quan tâm / Đang thử / Bỏ qua” ở các thẻ ý tưởng.</div>') + '</div>';
  }
  function viewMethod() {
    var c = S.cfg;
    return '<h1>ⓘ Phương pháp &amp; cách đọc</h1>' +
      '<h2>Công thức tổng điểm</h2><div class="box"><b>Tổng điểm = Σ (điểm tiêu chí × trọng số)</b>, thang 10 (làm tròn 2 chữ số). Hạng = sắp theo tổng điểm giảm dần; hòa thì ưu tiên “Tín hiệu quốc tế”, rồi “Nhu cầu”. Tiêu chí “Hợp giới trẻ VN” dựa trên các dữ kiện ở trang <a href="#/gioi-tre">Giới trẻ VN</a>; vùng (CN/KR/JP/US…) dùng để lọc, không cộng điểm riêng.</div>' +
      '<table class="w"><thead><tr><th>Tiêu chí</th><th class="n">Trọng số</th><th>Ý nghĩa điểm 10</th></tr></thead><tbody>' +
      c.criteria.map(function (x) { return '<tr><td>' + esc(x.label) + '</td><td class="n">' + Math.round(x.weight * 100) + '%</td><td>' + esc(x.hint) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<h2 style="margin-top:1.2rem">Mức xác minh của từng dữ kiện</h2><ul class="facts"><li class="v2"><span class="vb v2">2+ nguồn độc lập</span> ít nhất hai nguồn đã mở xác nhận (cùng trích một báo cáo gốc vẫn được ghi chú).</li><li class="v1"><span class="vb v1">1 nguồn gốc</span> chỉ có một nguồn gốc xác nhận — dùng thận trọng.</li><li class="vu"><span class="vb vu">chưa xác minh</span> chưa kiểm được; không dùng để chấm điểm.</li></ul>' +
      '<p>Mỗi nguồn ghi <b>tên + URL + ngày đăng + ngày truy cập + cách đọc</b>. Nhãn <span class="badge hyp">Giả thuyết</span> nghĩa là phần áp dụng cho Việt Nam chưa có bằng chứng — cần test trong 1 tuần.</p>' +
      '<h2>Bộ lọc</h2><p><b>Vốn:</b> ' + c.capital_tiers.map(function (t) { return esc(t.label); }).join(' · ') + ' (theo mức vốn tối đa ước tính). <b>Công sức:</b> suy ra từ điểm “Độ dễ thực hiện”. Quy đổi USD dùng tỷ giá giả định: ' + esc(c.usd_vnd_rate_note) + '</p>' +
      '<h2>Cài như app</h2><p>Android/Chrome: menu ⋮ → “Cài đặt ứng dụng / Thêm vào màn hình chính”. iPhone/Safari: Chia sẻ → “Thêm vào Màn hình chính”. Sau lần mở đầu tiên app dùng được cả khi mất mạng; dữ liệu mới luôn được lấy từ mạng trước.</p>' +
      '<h2>Lưu ý</h2><p class="muted">Đây là công cụ gợi ý ý tưởng, <b>không phải tư vấn đầu tư/pháp lý</b>. Số liệu thị trường là ước tính của bên thứ ba. Nguồn tiếng Trung được người soạn đọc và tóm tắt sang tiếng Việt.</p>';
  }

  /* ---------- router ---------- */
  function route() {
    var h = location.hash || '#/hom-nay';
    var seg = h.replace(/^#\/?/, '').split('/');
    var r = seg[0] || 'hom-nay';
    var html, nav = r;
    if (!S.cfg) return;
    if (r === 'hom-nay') html = viewDay(S.index.latest, true);
    else if (r === 'xep-hang') html = viewBoard();
    else if (r === 'luu-tru') { html = seg[1] ? viewDay(seg[1], false) : viewArchive(); }
    else if (r === 'da-luu') html = viewSaved();
    else if (r === 'phuong-phap') html = viewMethod();
    else if (r === 'tu-khoa') html = viewKeywords(seg[1]);
    else if (r === 'gioi-tre') html = viewYouth();
    else if (r === 'cong-cu') html = viewTools(seg[1]);
    else if (r === 'y-tuong' && seg[1]) { var it = S.ideas.filter(function (x) { return x.id === seg[1]; })[0]; S.openIds[seg[1]] = true; html = it ? '<p><a href="#/xep-hang">← Bảng xếp hạng</a></p>' + ideaCard(it, { overall: true }) : '<div class="empty">Không tìm thấy ý tưởng.</div>'; nav = 'xep-hang'; }
    else { html = '<div class="empty">Không tìm thấy trang. <a href="#/hom-nay">Về Hôm nay</a></div>'; }
    app.innerHTML = html;
    $$('#nav a').forEach(function (a) { if (a.dataset.r === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    updateCount();
    window.scrollTo(0, 0);
    if (r === 'cong-cu' && seg[1]) { var tf = document.getElementById('tool-' + seg[1]); if (tf) { tf.scrollIntoView({ block: 'center' }); tf.style.outline = '3px solid var(--brand)'; } }
    if (r === 'gioi-tre' && seg[1]) { var yf = document.getElementById('yfact-' + seg[1]); if (yf) { yf.scrollIntoView({ block: 'center' }); yf.style.background = 'color-mix(in srgb,var(--brand) 18%,transparent)'; } }
    if (r === 'hom-nay' && S.index.latest) { clearTimeout(route._t); route._t = setTimeout(function () { LS.set('bh.lastSeen', S.index.latest); }, 4000); }
  }
  function updateCount() {
    var el = $('#fcount'); if (!el) return;
    var n = hasFilter() ? [F.cat, F.type, F.cap, F.eff, F.st, F.reg, F.tool, F.q].filter(Boolean).length : 0;
    el.textContent = n ? n + ' bộ lọc đang bật' : 'không lọc';
  }
  function rerenderList() {
    var r = (location.hash || '#/hom-nay').replace(/^#\/?/, '').split('/')[0] || 'hom-nay';
    var list = $('#list'); if (!list) { route(); return; }
    var res;
    if (r === 'xep-hang') { res = sortList(S.ideas.filter(match)); list.innerHTML = listIdeas(res, { overall: true }); setCount(res.length, S.ideas.length); }
    else if (r === 'da-luu') { var all = S.ideas.filter(function (i) { return user.stars[i.id] || user.status[i.id]; }); res = sortList(all.filter(match)); list.innerHTML = all.length ? listIdeas(res, { overall: true }) : list.innerHTML; setCount(res.length, all.length); }
    else { var dt = r === 'luu-tru' ? location.hash.split('/')[2] : S.index.latest; var day = S.days[dt]; res = sortList(day.ideas.filter(match)); list.innerHTML = listIdeas(res); setCount(res.length, day.ideas.length, true); var tr = $('#trends'); if (tr) tr.innerHTML = trendsHtml(day); }
    updateCount();
  }
  function setCount(a, b, simple) { var e = $('#rescount'); if (e) e.textContent = simple ? a + '/' + b + ' ý tưởng' : a + '/' + b; }
  function refreshFilterUI() { var f = $('#filters'); if (!f) return; var op = f.open; var tmp = document.createElement('div'); tmp.innerHTML = filterBar(); var nf = tmp.firstChild; nf.open = op || hasFilter(); f.replaceWith(nf); updateCount(); }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button,a'); if (!t) return;
    if (t.dataset.kf !== undefined) { KF[t.dataset.kf] = t.dataset.v; var sy = window.scrollY; route(); window.scrollTo(0, sy); return; }
    if (t.dataset.tool) {
      F.tool = t.dataset.tool; var rt = (location.hash || '#/hom-nay').replace(/^#\/?/, '').split('/')[0] || 'hom-nay';
      if (rt === 'hom-nay' || rt === 'xep-hang' || rt === 'da-luu') { refreshFilterUI(); rerenderList(); var fl = $('#filters'); if (fl) fl.open = true; } else location.hash = '#/xep-hang';
      return;
    }
    if (t.dataset.f !== undefined) { F[t.dataset.f] = t.dataset.v; refreshFilterUI(); rerenderList(); return; }
    if (t.id === 'fclear' || t.id === 'fclear2') { F = { cat: '', type: '', cap: '', eff: '', st: '', reg: '', tool: '', sort: F.sort, q: '' }; $('#q').value = ''; refreshFilterUI(); rerenderList(); return; }
    var card = t.closest('.card');
    if (t.dataset.act === 'copyprompt' && card) {
      var pit = S.ideas.filter(function (x) { return x.id === card.dataset.id; })[0];
      if (pit && pit.claude_prompt) {
        var cn = pit.claude_prompt.length.toLocaleString('vi-VN');
        copyText(pit.claude_prompt).then(function () { toast('Đã sao chép prompt (' + cn + ' ký tự) — dán vào Claude'); }, function () {
          var d = card.querySelector('details.more'); if (d) { d.open = true; S.openIds[pit.id] = true; }
          var pre = card.querySelector('pre.prompt'); if (pre) { pre.focus(); var r = document.createRange(); r.selectNodeContents(pre); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
          toast('Không tự sao chép được — đã chọn sẵn prompt, hãy nhấn Ctrl/Cmd+C');
        });
      }
      return;
    }
    if (t.dataset.act && card) {
      var id = card.dataset.id;
      if (t.dataset.act === 'star') { if (user.stars[id]) delete user.stars[id]; else user.stars[id] = Date.now(); saveUser(); }
      else if (t.dataset.act === 'st') { if (user.status[id] === t.dataset.v) delete user.status[id]; else user.status[id] = t.dataset.v; saveUser(); }
      else if (t.dataset.act === 'link') { var url = location.href.split('#')[0] + '#/y-tuong/' + id; (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { toast('Đã sao chép liên kết'); }, function () { toast(url); }); return; }
      var wasOpen = card.querySelector('details.more').open; S.openIds[id] = wasOpen;
      var it = S.ideas.filter(function (x) { return x.id === id; })[0];
      var html = ideaCard(it, { overall: !!(location.hash.indexOf('xep-hang') >= 0 || location.hash.indexOf('da-luu') >= 0 || location.hash.indexOf('y-tuong') >= 0) });
      var tmp = document.createElement('div'); tmp.innerHTML = html; card.replaceWith(tmp.firstChild);
      var rr = (location.hash || '').indexOf('da-luu') >= 0; if (rr) rerenderList();
      return;
    }
    if (t.dataset.src) { e.preventDefault(); var el = document.getElementById(t.dataset.src); if (el) { el.scrollIntoView({ block: 'center' }); el.style.background = 'color-mix(in srgb,var(--brand) 18%,transparent)'; setTimeout(function () { el.style.background = ''; }, 1500); } return; }
    if (t.id === 'exp') { var blob = new Blob([JSON.stringify({ app: 'brain-hack', v: 1, exported: new Date().toISOString(), user: user }, null, 2)], { type: 'application/json' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'brain-hack-da-luu.json'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); return; }
    if (t.id === 'imp') { $('#impf').click(); return; }
  });
  document.addEventListener('toggle', function (e) { var d = e.target; if (d.matches && d.matches('details.more')) S.openIds[d.dataset.id] = d.open; }, true);
  document.addEventListener('change', function (e) {
    var s = e.target;
    if (s.dataset && s.dataset.fs) { F[s.dataset.fs] = s.value; refreshFilterUI(); rerenderList(); }
    if (s.id === 'impf' && s.files[0]) { var fr = new FileReader(); fr.onload = function () { try { var j = JSON.parse(fr.result); var u = j.user || j; if (u && u.stars && u.status) { Object.assign(user.stars, u.stars); Object.assign(user.status, u.status); saveUser(); toast('Đã khôi phục dữ liệu đã lưu'); route(); } else toast('File không đúng định dạng'); } catch (er) { toast('File không đọc được'); } }; fr.readAsText(s.files[0]); }
  });
  var qEl = $('#q'), qT;
  qEl.addEventListener('input', function () {
    clearTimeout(qT); qT = setTimeout(function () {
      F.q = qEl.value.trim();
      var r = (location.hash || '#/hom-nay').replace(/^#\/?/, '').split('/')[0];
      if (r === 'cong-cu') { var sy3 = window.scrollY; route(); window.scrollTo(0, sy3); return; }
      if (F.q && (r === 'phuong-phap' || r === 'gioi-tre' || (r === 'luu-tru' && !location.hash.split('/')[2]))) { location.hash = '#/xep-hang'; return; }
      if (r === 'tu-khoa') { var sy2 = window.scrollY; route(); window.scrollTo(0, sy2); return; }
      refreshFilterUI(); rerenderList();
    }, 160);
  });
  window.addEventListener('hashchange', route);
  (window.requestIdleCallback || function (f) { setTimeout(f, 3000); })(function () {
    try { S.ideas.forEach(function (i) { if (i.image) fetch(i.image).catch(function () {}); }); } catch (e) {}
  });

  /* ---------- theme ---------- */
  function currentTheme() { var t = document.documentElement.getAttribute('data-theme'); if (t) return t; return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function paintTheme() {
    var t = currentTheme(); $('#theme').textContent = t === 'dark' ? '☀' : '☾'; $('#theme').setAttribute('aria-label', t === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
    $('#meta-theme').setAttribute('content', t === 'dark' ? '#0c1311' : '#0f766e');
  }
  $('#theme').addEventListener('click', function () { var n = currentTheme() === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', n); try { localStorage.setItem('bh.theme', n); } catch (e) {} paintTheme(); });
  if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintTheme); } catch (e) {} }
  paintTheme();

  /* ---------- PWA ---------- */
  var deferred;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; $('#install').hidden = false; });
  $('#install').addEventListener('click', function () { if (!deferred) return; deferred.prompt(); deferred.userChoice.finally(function () { deferred = null; $('#install').hidden = true; }); });
  window.addEventListener('appinstalled', function () { $('#install').hidden = true; toast('Đã cài brain-hack'); });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing; if (!nw) return;
          nw.addEventListener('statechange', function () { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Có phiên bản app mới', 'Tải lại', function () { location.reload(); }); });
        });
        setInterval(function () { reg.update().catch(function () {}); }, 6 * 3600e3);
      }).catch(function () {});
    });
  }

  /* ---------- boot ---------- */
  load().then(function () {
    $('#dataver').textContent = 'Dữ liệu: ' + S.index.days.length + ' ngày · mới nhất ' + dmy(S.index.latest) + ' · cập nhật index ' + dmy(S.index.updated);
    route();
  }).catch(function (err) {
    app.innerHTML = '<div class="empty"><p><b>Không tải được dữ liệu.</b></p><p class="muted small">' + esc(err.message) + '</p><p>Kiểm tra mạng rồi <button class="btn" onclick="location.reload()">thử lại</button>.</p></div>';
  });
})();
