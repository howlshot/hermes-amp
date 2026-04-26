(function () {
  "use strict";

  var SDK = window.__HERMES_PLUGIN_SDK__;
  var registry = window.__HERMES_PLUGINS__;

  if (!SDK || !registry) {
    console.warn("[hermes-amp] Hermes dashboard plugin SDK was not found.");
    return;
  }

  var React = SDK.React;
  var e = React.createElement;
  var HERMES_AMP_REFRESH_EVENT = "hermes-amp:refresh";
  var HERMES_AMP_MIX_STORAGE_KEY = "hermes-amp-mix-v1";
  var MIX_BANDS = [
    { key: "msg", label: "MSG" },
    { key: "tok", label: "TOK" },
    { key: "api", label: "API" },
    { key: "cost", label: "COST" },
    { key: "log", label: "LOG" },
    { key: "err", label: "ERR" },
    { key: "warn", label: "WARN" },
    { key: "rec", label: "REC" },
    { key: "cache", label: "CACHE" },
    { key: "runs", label: "RUNS" }
  ];
  var MIX_PRESETS = {
    BAL: { msg: 100, tok: 100, api: 100, cost: 100, log: 100, err: 100, warn: 100, rec: 100, cache: 100, runs: 100 },
    TOK: { msg: 70, tok: 180, api: 90, cost: 100, log: 45, err: 75, warn: 75, rec: 100, cache: 135, runs: 90 },
    OPS: { msg: 90, tok: 70, api: 170, cost: 130, log: 155, err: 130, warn: 140, rec: 115, cache: 80, runs: 125 },
    ERR: { msg: 45, tok: 55, api: 80, cost: 75, log: 130, err: 200, warn: 175, rec: 130, cache: 45, runs: 70 },
    RESET: { msg: 100, tok: 100, api: 100, cost: 100, log: 100, err: 100, warn: 100, rec: 100, cache: 100, runs: 100 }
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function defaultMix() {
    return Object.assign({}, MIX_PRESETS.BAL);
  }

  function sanitizeMix(candidate) {
    var next = defaultMix();
    if (!candidate || typeof candidate !== "object") return next;
    MIX_BANDS.forEach(function (band) {
      if (Object.prototype.hasOwnProperty.call(candidate, band.key)) {
        next[band.key] = clamp(Math.round(numberOrZero(candidate[band.key])), 0, 200);
      }
    });
    return next;
  }

  function loadStoredMix() {
    try {
      return sanitizeMix(JSON.parse(window.localStorage.getItem(HERMES_AMP_MIX_STORAGE_KEY) || "null"));
    } catch (error) {
      return defaultMix();
    }
  }

  function mixValue(mix, key) {
    if (mix && Object.prototype.hasOwnProperty.call(mix, key)) {
      return clamp(numberOrZero(mix[key]), 0, 200);
    }
    return 100;
  }

  function mixWeight(mix, key) {
    return mixValue(mix, key) / 100;
  }

  function useDataMix() {
    var _React$useState2 = React.useState(loadStoredMix),
      mix = _React$useState2[0],
      setMixState = _React$useState2[1];

    React.useEffect(function () {
      try {
        window.localStorage.setItem(HERMES_AMP_MIX_STORAGE_KEY, JSON.stringify(sanitizeMix(mix)));
      } catch (error) {
        // Browser-local tuning should never break the dashboard.
      }
    }, [mix]);

    function setMix(next) {
      setMixState(function (previous) {
        return sanitizeMix(typeof next === "function" ? next(previous) : next);
      });
    }

    return [mix, setMix];
  }

  function readStatusLabel(status) {
    if (!status) return "WAITING";
    if (status.status) return String(status.status).toUpperCase();
    if (status.state) return String(status.state).toUpperCase();
    if (status.running === false) return "IDLE";
    return "ONLINE";
  }

  function readModelLabel(status) {
    if (!status) return "NO SIGNAL";
    return (
      status.model ||
      status.active_model ||
      status.default_model ||
      (status.config && status.config.model) ||
      status.version ||
      "LOCAL AGENT"
    );
  }

  function sessionTitle(session, index) {
    return (
      session.title ||
      session.name ||
      session.summary ||
      session.id ||
      "Session " + String(index + 1).padStart(2, "0")
    );
  }

  function numberOrZero(value) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function formatCompact(value) {
    var numeric = numberOrZero(value);
    if (numeric >= 1000000) return (numeric / 1000000).toFixed(1) + "M";
    if (numeric >= 1000) return (numeric / 1000).toFixed(1) + "K";
    return String(Math.round(numeric));
  }

  function formatCost(value) {
    var numeric = numberOrZero(value);
    if (!numeric) return "$0";
    if (numeric < 0.01) return "$" + numeric.toFixed(4);
    return "$" + numeric.toFixed(2);
  }

  function trimText(value, limit) {
    var text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= limit) return text;
    return text.slice(0, Math.max(0, limit - 3)).trim() + "...";
  }

  function normalizeCronJobs(response) {
    if (Array.isArray(response)) return response;
    if (response && Array.isArray(response.jobs)) return response.jobs;
    if (response && Array.isArray(response.items)) return response.items;
    return [];
  }

  function cronJobTitle(job, index) {
    if (!job) return "CRON " + String(index + 1).padStart(2, "0");
    return trimText(
      job.name ||
      job.title ||
      job.prompt ||
      job.id ||
      ("CRON " + String(index + 1).padStart(2, "0")),
      54
    );
  }

  function cronDate(value) {
    if (!value) return "NO RUN";
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return trimText(value, 20);
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function cronRelative(value) {
    if (!value) return "NO RUN";
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return trimText(value, 10);
    var diffMinutes = Math.ceil((date.getTime() - Date.now()) / 60000);
    if (diffMinutes <= -1) return "DUE";
    if (diffMinutes <= 1) return "NOW";
    if (diffMinutes < 60) return diffMinutes + "M";
    var hours = Math.ceil(diffMinutes / 60);
    if (hours < 48) return hours + "H";
    return Math.ceil(hours / 24) + "D";
  }

  function cronJobSignal(job) {
    var state = String((job && job.state) || "").toLowerCase();
    var nextRun = job && job.next_run_at ? new Date(job.next_run_at) : null;
    var hasNext = nextRun && Number.isFinite(nextRun.getTime());
    if (job && job.running) return { label: "RUN", className: "is-running" };
    if (state === "running") return { label: "RUN", className: "is-running" };
    if (state === "paused") return { label: "PAUSE", className: "is-paused" };
    if (state === "completed") return { label: "DONE", className: "is-done" };
    if (job && job.last_status === "error") return { label: "ERR", className: "is-error" };
    if (job && job.enabled === false) return { label: "OFF", className: "is-paused" };
    if (hasNext && nextRun.getTime() <= Date.now() + 15000) return { label: "DUE", className: "is-due" };
    return { label: "ARMED", className: "is-armed" };
  }

  function cronSortScore(job) {
    var signal = cronJobSignal(job).label;
    var stateWeight = { RUN: 0, DUE: 1, ERR: 2, ARMED: 3, PAUSE: 4, OFF: 5, DONE: 6 }[signal] || 7;
    var nextRun = job && job.next_run_at ? new Date(job.next_run_at) : null;
    var timeScore = nextRun && Number.isFinite(nextRun.getTime()) ? nextRun.getTime() / 10000000000000 : 1;
    return stateWeight + timeScore;
  }

  function cronSummary(jobs) {
    var list = jobs || [];
    var armed = list.filter(function (job) {
      var state = String(job.state || "").toLowerCase();
      return job.enabled !== false && state !== "paused" && state !== "completed";
    }).length;
    var due = list.filter(function (job) {
      return cronJobSignal(job).label === "DUE" || cronJobSignal(job).label === "RUN";
    }).length;
    var nextJob = list
      .filter(function (job) {
        var nextRun = job.next_run_at ? new Date(job.next_run_at) : null;
        return nextRun && Number.isFinite(nextRun.getTime()) && job.enabled !== false;
      })
      .sort(function (a, b) {
        return new Date(a.next_run_at).getTime() - new Date(b.next_run_at).getTime();
      })[0];
    return {
      left: armed + " ARMED / " + due + " DUE",
      right: nextJob ? "NEXT " + cronRelative(nextJob.next_run_at) : "NO NEXT"
    };
  }

  function analyticsTotals(data) {
    var analytics = data && data.analytics ? data.analytics : {};
    return analytics.totals || {};
  }

  function totalTokenCount(data) {
    var totals = analyticsTotals(data);
    var analyticTokens = (
      numberOrZero(totals.total_input) +
      numberOrZero(totals.total_output) +
      numberOrZero(totals.total_cache_read) +
      numberOrZero(totals.total_reasoning)
    );
    if (analyticTokens) return analyticTokens;
    return (data.sessions || []).reduce(function (sum, session) {
      return sum + sessionTokens(session);
    }, 0);
  }

  function totalApiCalls(data) {
    var totals = analyticsTotals(data);
    return numberOrZero(totals.total_api_calls) || (data.sessions || []).reduce(function (sum, session) {
      return sum + numberOrZero(session.api_call_count || session.api_calls);
    }, 0);
  }

  function totalCacheTokens(data) {
    var totals = analyticsTotals(data);
    return numberOrZero(totals.total_cache_read) || (data.sessions || []).reduce(function (sum, session) {
      return sum + numberOrZero(session.cache_read_tokens);
    }, 0);
  }

  function logPressure(data) {
    var lines = data.logs && Array.isArray(data.logs.lines) ? data.logs.lines : [];
    return lines.reduce(function (score, line) {
      var text = String(line).toLowerCase();
      if (text.indexOf("error") >= 0 || text.indexOf("exception") >= 0 || text.indexOf("fail") >= 0) return score + 1;
      if (text.indexOf("warn") >= 0) return score + 0.5;
      return score;
    }, 0);
  }

  function scaleMeter(value, fullScale) {
    return clamp((numberOrZero(value) / Math.max(fullScale, 1)) * 100, 0, 100);
  }

  function signalMeters(data) {
    var safeData = data || {};
    return [
      { label: "HEALTH", value: safeData.error ? 10 : (safeData.status ? 100 : 45), title: safeData.error || readStatusLabel(safeData.status) },
      { label: "TOKENS", value: scaleMeter(totalTokenCount(safeData), 100000), title: formatCompact(totalTokenCount(safeData)) + " tokens" },
      { label: "API", value: scaleMeter(totalApiCalls(safeData), 500), title: formatCompact(totalApiCalls(safeData)) + " API calls", tone: "cool" },
      { label: "CACHE", value: scaleMeter(totalCacheTokens(safeData), 50000), title: formatCompact(totalCacheTokens(safeData)) + " cache tokens", tone: "cool" },
      { label: "ERRORS", value: scaleMeter(logPressure(safeData), 10), title: formatCompact(logPressure(safeData)) + " log pressure", tone: "danger" }
    ];
  }

  function useHermesAmpData() {
    var _React$useState = React.useState({
        status: null,
        sessions: [],
        error: null,
        updatedAt: null
      }),
      data = _React$useState[0],
      setData = _React$useState[1];

    React.useEffect(function () {
      var cancelled = false;

      function load() {
        var statusPromise = SDK.api && SDK.api.getStatus
          ? SDK.api.getStatus()
          : Promise.resolve(null);
        var sessionsPromise = SDK.api && SDK.api.getSessions
          ? SDK.api.getSessions(12)
          : Promise.resolve({ sessions: [] });
        var analyticsPromise = SDK.fetchJSON
          ? SDK.fetchJSON("/api/analytics/usage?days=30").catch(function () { return null; })
          : Promise.resolve(null);
        var logsPromise = SDK.fetchJSON
          ? SDK.fetchJSON("/api/logs?lines=80").catch(function () { return null; })
          : Promise.resolve(null);
        var cronSource;
        try {
          cronSource = SDK.api && SDK.api.getCronJobs
            ? SDK.api.getCronJobs()
            : (SDK.fetchJSON ? SDK.fetchJSON("/api/cron/jobs") : []);
        } catch (error) {
          cronSource = Promise.reject(error);
        }
        var cronPromise = Promise.resolve(cronSource)
          .then(function (response) {
            return { jobs: normalizeCronJobs(response), error: null };
          })
          .catch(function (error) {
            return {
              jobs: [],
              error: error && error.message ? error.message : "Unable to read cron jobs"
            };
          });

        Promise.all([statusPromise, sessionsPromise, analyticsPromise, logsPromise, cronPromise])
          .then(function (result) {
            if (cancelled) return;
            var status = result[0];
            var sessionsResponse = result[1] || {};
            var analytics = result[2];
            var logs = result[3];
            var cron = result[4] || {};
            setData({
              status: status,
              sessions: sessionsResponse.sessions || sessionsResponse.items || [],
              sessionTotal: sessionsResponse.total || 0,
              analytics: analytics,
              logs: logs,
              cronJobs: cron.jobs || [],
              cronError: cron.error || null,
              error: null,
              updatedAt: new Date()
            });
          })
          .catch(function (error) {
            if (cancelled) return;
            setData(function (previous) {
              return {
                status: previous.status,
                sessions: previous.sessions,
                sessionTotal: previous.sessionTotal,
                analytics: previous.analytics,
                logs: previous.logs,
                cronJobs: previous.cronJobs,
                cronError: previous.cronError,
                error: error && error.message ? error.message : "Unable to read dashboard API",
                updatedAt: previous.updatedAt
              };
            });
          });
      }

      load();
      var timer = window.setInterval(load, 5000);
      window.addEventListener(HERMES_AMP_REFRESH_EVENT, load);
      return function () {
        cancelled = true;
        window.removeEventListener(HERMES_AMP_REFRESH_EVENT, load);
        window.clearInterval(timer);
      };
    }, []);

    return data;
  }

  function SegmentText(props) {
    return e(
      "span",
      { className: "hermes-amp-segment-text", title: props.title || props.children },
      props.children
    );
  }

  function Led(props) {
    var className = "hermes-amp-led" + (props.active === false ? " is-dim" : "");
    return e(
      "span",
      { className: "hermes-amp-led-wrap", title: props.label },
      e("span", { className: className }),
      e("span", { className: "hermes-amp-led-label" }, props.label)
    );
  }

  function EqBars(props) {
    var seed = props.seed || 0;
    var bars = [];
    for (var index = 0; index < 18; index += 1) {
      var height = 24 + ((seed + index * 17) % 62);
      bars.push(
        e("span", {
          key: index,
          className: "hermes-amp-eq-bar",
          style: {
            height: String(height) + "%"
          }
        })
      );
    }
    return e("div", { className: "hermes-amp-eq", "aria-hidden": "true" }, bars);
  }

  function sessionCost(session) {
    return (
      numberOrZero(session.actual_cost) ||
      numberOrZero(session.estimated_cost) ||
      numberOrZero(session.cost) ||
      0
    );
  }

  function sessionTokens(session) {
    return (
      numberOrZero(session.input_tokens) +
      numberOrZero(session.output_tokens) +
      numberOrZero(session.cache_read_tokens) +
      numberOrZero(session.reasoning_tokens)
    );
  }

  function recencyFactor(index, count, mix) {
    var position = count <= 1 ? 1 : index / Math.max(count - 1, 1);
    return clamp(1 + (mixWeight(mix, "rec") - 1) * position * 0.5, 0.35, 1.75);
  }

  function bandByKey(key) {
    return MIX_BANDS.find(function (band) { return band.key === key; }) || { key: key, label: String(key || "MIX").toUpperCase() };
  }

  function chartLens(mix) {
    var candidates = MIX_BANDS.filter(function (band) { return band.key !== "rec"; });
    var winner = candidates.reduce(function (best, band) {
      var value = mixValue(mix, band.key);
      var delta = Math.abs(value - 100);
      return delta > best.delta ? { band: band, delta: delta } : best;
    }, { band: null, delta: 0 });
    return winner.band && winner.delta >= 5 ? winner.band : { key: "mix", label: "MIX" };
  }

  function lensMixValue(mix, lens) {
    if (!lens || lens.key === "mix") {
      var total = MIX_BANDS.reduce(function (sum, band) {
        return band.key === "rec" ? sum : sum + mixValue(mix, band.key);
      }, 0);
      return total / Math.max(MIX_BANDS.length - 1, 1);
    }
    return mixValue(mix, lens.key);
  }

  function sessionMetric(session, lensKey, mix) {
    var tokens = sessionTokens(session);
    var messages = numberOrZero(session.message_count) || numberOrZero(session.messages_count);
    var apiCalls = numberOrZero(session.api_call_count) || numberOrZero(session.api_calls);
    var text = String(session.status || session.state || session.error || session.summary || "").toLowerCase();
    if (lensKey === "msg") return messages;
    if (lensKey === "tok") return tokens;
    if (lensKey === "api") return apiCalls;
    if (lensKey === "cost") return sessionCost(session) * 100000;
    if (lensKey === "cache") return numberOrZero(session.cache_read_tokens);
    if (lensKey === "runs") return 1;
    if (lensKey === "err") return text.indexOf("error") >= 0 || text.indexOf("fail") >= 0 ? 1 : 0;
    if (lensKey === "warn") return text.indexOf("warn") >= 0 ? 1 : 0;
    if (lensKey === "log") return messages || 1;
    return (
      messages * 80 * mixWeight(mix, "msg") +
      tokens * mixWeight(mix, "tok") +
      apiCalls * 250 * mixWeight(mix, "api") +
      numberOrZero(session.cache_read_tokens) * mixWeight(mix, "cache") +
      sessionCost(session) * 100000 * mixWeight(mix, "cost") +
      100 * mixWeight(mix, "runs")
    );
  }

  function dailyMetric(row, lensKey, mix) {
    var tokens = (
      numberOrZero(row.input_tokens) +
      numberOrZero(row.output_tokens) +
      numberOrZero(row.reasoning_tokens) +
      numberOrZero(row.cache_read_tokens)
    );
    var sessions = numberOrZero(row.sessions) || numberOrZero(row.total_sessions);
    if (lensKey === "msg") return numberOrZero(row.messages) || numberOrZero(row.message_count) || sessions * 8;
    if (lensKey === "tok") return tokens;
    if (lensKey === "api") return numberOrZero(row.api_calls) || numberOrZero(row.total_api_calls);
    if (lensKey === "cost") return (numberOrZero(row.actual_cost) || numberOrZero(row.estimated_cost)) * 100000;
    if (lensKey === "cache") return numberOrZero(row.cache_read_tokens);
    if (lensKey === "runs") return sessions;
    if (lensKey === "err") return numberOrZero(row.errors) || numberOrZero(row.error_count);
    if (lensKey === "warn") return numberOrZero(row.warnings) || numberOrZero(row.warning_count);
    if (lensKey === "log") return numberOrZero(row.logs) || numberOrZero(row.log_lines);
    return (
      tokens * mixWeight(mix, "tok") +
      numberOrZero(row.cache_read_tokens) * mixWeight(mix, "cache") +
      numberOrZero(row.api_calls) * 250 * mixWeight(mix, "api") +
      sessions * 100 * mixWeight(mix, "runs") +
      (numberOrZero(row.actual_cost) || numberOrZero(row.estimated_cost)) * 100000 * mixWeight(mix, "cost")
    );
  }

  function lineMetric(line, lensKey) {
    var text = String(line).toLowerCase();
    if (lensKey === "err") return text.indexOf("error") >= 0 || text.indexOf("exception") >= 0 || text.indexOf("fail") >= 0 ? 1 : 0;
    if (lensKey === "warn") return text.indexOf("warn") >= 0 || text.indexOf("deprecated") >= 0 ? 1 : 0;
    if (lensKey === "api") return text.indexOf("api") >= 0 || text.indexOf("request") >= 0 || text.indexOf("http") >= 0 ? 1 : 0;
    if (lensKey === "tok") return text.indexOf("token") >= 0 || text.indexOf("tok") >= 0 ? 1 : 0;
    if (lensKey === "cost") return text.indexOf("cost") >= 0 || text.indexOf("$") >= 0 ? 1 : 0;
    if (lensKey === "cache") return text.indexOf("cache") >= 0 ? 1 : 0;
    if (lensKey === "runs") return text.indexOf("session") >= 0 || text.indexOf("run") >= 0 ? 1 : 0;
    if (lensKey === "msg") return text.indexOf("message") >= 0 || text.indexOf("chat") >= 0 ? 1 : 0;
    return 1;
  }

  function normalizeChartBars(items, mix, lens, unitLabel) {
    var activeLens = lens || chartLens(mix);
    var selectedMix = lensMixValue(mix, activeLens);
    var values = items.map(function (item, index) {
      return numberOrZero(item.value) * recencyFactor(index, items.length, mix);
    });
    var max = Math.max.apply(null, values.concat([1]));
    var live = values.some(function (value) { return value > 0; });
    if (!live) return [];
    return items.map(function (item, index) {
      var value = values[index];
      var normalized = value / max;
      var range = 52 + selectedMix * 0.18;
      var lift = (selectedMix - 100) * 0.08;
      return {
        key: item.key || index,
        value: value,
        height: clamp(10 + normalized * range + lift, 6, 100),
        label: item.label || unitLabel,
        title: (item.title || formatCompact(value) + " " + unitLabel) + " // " + activeLens.label + " " + Math.round(selectedMix) + "%"
      };
    });
  }

  function buildDailyBars(analytics, count, mix, lens) {
    var daily = analytics && Array.isArray(analytics.daily) ? analytics.daily.slice(-count) : [];
    if (!daily.length) return [];
    var activeLens = lens || chartLens(mix);
    return normalizeChartBars(daily.map(function (row, index) {
      return {
        key: row.day || index,
        value: dailyMetric(row, activeLens.key, mix),
        label: row.day || "day",
        title: (row.day || "day") + " // " + activeLens.label
      };
    }), mix, activeLens, "daily units");
  }

  function buildLogBars(logs, count, mix, lens) {
    var lines = logs && Array.isArray(logs.lines) ? logs.lines : [];
    if (!lines.length) return [];
    var activeLens = lens || chartLens(mix);
    var buckets = [];
    var bucketSize = Math.max(1, Math.ceil(lines.length / count));
    for (var index = 0; index < count; index += 1) {
      var bucket = lines.slice(index * bucketSize, (index + 1) * bucketSize);
      var score = bucket.reduce(function (total, line) {
        return total + lineMetric(line, activeLens.key);
      }, 0);
      buckets.push({
        key: "log-" + index,
        value: score,
        label: bucket.length + " lines",
        title: bucket.length + " log lines // " + activeLens.label
      });
    }
    return normalizeChartBars(buckets, mix, activeLens, "log hits");
  }

  function buildSessionBars(sessions, analytics, count, mix, lens) {
    if (sessions && sessions.length) {
      var source = sessions.slice(0, count).reverse();
      var activeLens = lens || chartLens(mix);
      return normalizeChartBars(source.map(function (session, index) {
        return {
          key: "session-" + index,
          value: sessionMetric(session, activeLens.key, mix),
          label: "run " + String(index + 1).padStart(2, "0"),
          title: sessionTitle(session, index) + " // " + activeLens.label
        };
      }), mix, activeLens, "session units");
    }
    return buildDailyBars(analytics, count, mix, lens);
  }

  function buildPreviewBars(count, mix, lens) {
    var activeLens = lens || chartLens(mix);
    var selectedMix = lensMixValue(mix, activeLens);
    var recency = mixWeight(mix, "rec");
    var volatility = 0.24 + mixWeight(mix, activeLens.key === "mix" ? "tok" : activeLens.key) * 0.13 + mixWeight(mix, "err") * 0.04;
    var seed = activeLens.label.split("").reduce(function (sum, character) {
      return sum + character.charCodeAt(0);
    }, 0);
    var bars = [];
    for (var index = 0; index < count; index += 1) {
      var progress = index / Math.max(count - 1, 1);
      var trend = clamp(0.9 + (recency - 1) * progress, 0.45, 1.65);
      var wave = Math.sin(progress * Math.PI * (1.2 + selectedMix / 80) + seed * 0.04);
      var chop = (((seed + index * 37) % 23) / 23) - 0.5;
      var value = clamp((48 + wave * 34 * volatility + chop * 24) * trend + (selectedMix - 100) * 0.22, 4, 100);
      bars.push({
        key: "preview-" + activeLens.key + "-" + index,
        value: value,
        height: value,
        label: "preview",
        title: activeLens.label + " preview // mixer " + Math.round(selectedMix) + "%",
        preview: true
      });
    }
    return bars;
  }

  function buildActivityBars(data, mode, count, mix, lens) {
    var bars = [];
    var activeLens = lens || chartLens(mix);
    if (mode === "logs") {
      bars = buildLogBars(data.logs, count, mix, activeLens);
    } else if (["log", "err", "warn"].indexOf(activeLens.key) >= 0) {
      bars = buildLogBars(data.logs, count, mix, activeLens);
    } else if (mode === "sessions") {
      bars = buildSessionBars(data.sessions || [], data.analytics, count, mix, activeLens);
    } else {
      bars = buildDailyBars(data.analytics, count, mix, activeLens);
      if (!bars.length) bars = buildSessionBars(data.sessions || [], data.analytics, count, mix, activeLens);
    }
    return bars.length ? bars : buildPreviewBars(count, mix, activeLens);
  }

  function mixSummary(mix) {
    var winner = MIX_BANDS.reduce(function (best, band) {
      var value = Math.abs(mixValue(mix, band.key) - 100);
      return value > best.value ? { label: band.label, value: value } : best;
    }, { label: "BAL", value: 0 });
    return winner.value >= 20 ? winner.label : "BAL";
  }

  function activitySummary(data, mode, mix) {
    var analytics = data.analytics || {};
    var totals = analytics.totals || {};
    var lens = chartLens(mix);
    var chartLabel = lens.label + " CHART";
    var totalTokens = (
      numberOrZero(totals.total_input) +
      numberOrZero(totals.total_output) +
      numberOrZero(totals.total_cache_read) +
      numberOrZero(totals.total_reasoning)
    );
    if (mode === "logs") {
      var lines = data.logs && data.logs.lines ? data.logs.lines.length : 0;
      return lines ? lines + " LINES // LIVE TAIL" : "NO LOG SIGNAL // STANDBY";
    }
    if (mode === "sessions") {
      return (
        formatCompact(data.sessionTotal || totals.total_sessions || 0) +
        " SESSIONS // " +
        formatCompact(totals.total_api_calls || 0) +
        " API // " +
        formatCompact(totalTokens) +
        " TOK // MIX " +
        mixSummary(mix) +
        " // " +
        chartLabel
      );
    }
    return (
      readStatusLabel(data.status) +
      " // " +
      formatCompact(totals.total_sessions || data.sessionTotal || 0) +
      " RUNS // " +
      formatCost(totals.total_actual_cost || totals.total_estimated_cost) +
      " // MIX " +
      mixSummary(mix) +
      " // " +
      chartLabel
    );
  }

  function chartPath(bars) {
    if (!bars.length) return "";
    return bars.map(function (bar, index) {
      var x = bars.length <= 1 ? 50 : (index / (bars.length - 1)) * 100;
      var y = 100 - clamp(bar.height, 0, 100);
      return (index ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2);
    }).join(" ");
  }

  function ActivitySpectrum(props) {
    var count = props.count || 18;
    var data = props.data || {};
    var mix = props.mix || defaultMix();
    var mode = props.mode || "system";
    var lens = chartLens(mix);
    var bars = buildActivityBars(data, mode, count, mix, lens);
    var path = chartPath(bars);
    var preview = bars.some(function (bar) { return bar.preview; });
    var hasSignal = bars.some(function (bar) { return !bar.preview && bar.value > 0; });
    var caption = lens.label + " CHART // " + (preview ? "PREVIEW" : "LIVE");
    var selectedMix = lensMixValue(mix, lens);
    return e(
      "div",
      {
        className: "hermes-amp-spectrum is-chart" + (hasSignal ? "" : " is-idle") + (preview ? " is-preview" : ""),
        style: {
          "--amp-mix": String(Math.round(selectedMix)),
          "--amp-speed": String(clamp(1550 - selectedMix * 4, 620, 1550)) + "ms"
        },
        title: props.title || activitySummary(data, mode, mix) + " // " + caption + " // " + Math.round(selectedMix) + "%"
      },
      e("div", { className: "hermes-amp-spectrum-caption" }, caption),
      e(
        "div",
        { className: "hermes-amp-spectrum-bars" },
        bars.map(function (bar, index) {
          return e("span", {
            key: bar.key || index,
            className: "hermes-amp-spectrum-bar" + (bar.preview ? " is-preview" : ""),
            style: {
              height: String(bar.height) + "%",
              animationDelay: String((index % 8) * -110) + "ms"
            },
            title: bar.title || bar.label
          });
        })
      ),
      e(
        "svg",
        { className: "hermes-amp-spectrum-line", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true" },
        e("path", { className: "hermes-amp-spectrum-area", d: path + " L 100 100 L 0 100 Z" }),
        e("path", { className: "hermes-amp-spectrum-trace", d: path, vectorEffect: "non-scaling-stroke" })
      )
    );
  }

  function Meter(props) {
    var value = clamp(props.value || 0, 0, 100);
    var tone = props.tone ? " is-" + props.tone : "";
    return e(
      "div",
      { className: "hermes-amp-meter-row" + tone, title: props.title || props.label },
      e("div", { className: "hermes-amp-meter-label" }, props.label),
      e(
        "div",
        { className: "hermes-amp-meter-track" },
        e("span", {
          className: "hermes-amp-meter-fill",
          style: { width: value + "%" }
        })
      ),
      e("div", { className: "hermes-amp-meter-value" }, Math.round(value) + "%")
    );
  }

  function HeaderLeft() {
    return e(
      "div",
      { className: "hermes-amp-header-brand", title: "Hermes Amp" },
      e("span", { className: "hermes-amp-header-grip", "aria-hidden": "true" }),
      e(SegmentText, null, "HERMES.AMP"),
      e("span", { className: "hermes-amp-header-sub" }, "2.0")
    );
  }

  function HeaderRight() {
    var data = useHermesAmpData();
    var status = readStatusLabel(data.status);
    var label = data.status && data.status.version ? "v" + data.status.version : status;
    return e(
      "div",
      { className: "hermes-amp-header-status" },
      e(Led, { label: status, active: !data.error }),
      e("span", { className: "hermes-amp-mini-display", title: label }, label)
    );
  }

  function TransportControls(props) {
    var includeSessions = props && props.includeSessions;
    function refreshData() {
      window.dispatchEvent(new Event(HERMES_AMP_REFRESH_EVENT));
    }

    return e(
      "div",
      { className: "hermes-amp-transport" },
      e("a", { href: "/chat", title: "Start chat", "aria-label": "Start chat" }, e("span", { "aria-hidden": "true" }, "+"), e("strong", null, "CHAT")),
      includeSessions ? e("a", { href: "/sessions", title: "Open sessions", "aria-label": "Open sessions" }, e("span", { "aria-hidden": "true" }, ">"), e("strong", null, "SESS")) : null,
      e("a", { href: "/logs", title: "Open logs", "aria-label": "Open logs" }, e("span", { "aria-hidden": "true" }, "#"), e("strong", null, "LOGS")),
      e("a", { href: "/analytics", title: "Open analytics", "aria-label": "Open analytics" }, e("span", { "aria-hidden": "true" }, "^"), e("strong", null, "STATS")),
      e("button", { type: "button", onClick: refreshData, title: "Refresh HUD data", "aria-label": "Refresh HUD data" }, e("span", { "aria-hidden": "true" }, "*"), e("strong", null, "SYNC"))
    );
  }

  function Sidebar() {
    var data = useHermesAmpData();
    var mix = useDataMix()[0];
    var sessions = data.sessions || [];
    var status = readStatusLabel(data.status);
    var meters = signalMeters(data);

    return e(
      "aside",
      { className: "hermes-amp-sidebar", "aria-label": "Hermes Amp dashboard HUD" },
      e(
        "div",
        { className: "hermes-amp-window" },
        e(
          "div",
          { className: "hermes-amp-titlebar" },
          e("span", null, "NOW PLAYING"),
          e("span", { className: "hermes-amp-window-buttons", "aria-hidden": "true" }, "_ [] X")
        ),
        e(
          "div",
          { className: "hermes-amp-display" },
          e(SegmentText, { title: readModelLabel(data.status) }, readModelLabel(data.status)),
          e("span", { className: "hermes-amp-display-sub" }, status)
        )
      ),
      e(ActivitySpectrum, { data: data, mix: mix, mode: "system", count: 18 }),
      e(
        "div",
        { className: "hermes-amp-window" },
        e("div", { className: "hermes-amp-titlebar" }, e("span", null, "SIGNAL METERS")),
        e(
          "div",
          { className: "hermes-amp-meter-stack" },
          meters.map(function (meter) {
            return e(Meter, { key: meter.label, label: meter.label, value: meter.value, title: meter.title, tone: meter.tone });
          })
        )
      ),
      e(
        "div",
        { className: "hermes-amp-window" },
        e("div", { className: "hermes-amp-titlebar" }, e("span", null, "PLAYLIST")),
        e(
          "ol",
          { className: "hermes-amp-playlist" },
          sessions.length
            ? sessions.slice(0, 7).map(function (session, index) {
                return e(
                  "li",
                  { key: session.id || index },
                  e("span", { className: "hermes-amp-track-index" }, String(index + 1).padStart(2, "0")),
                  e("span", { className: "hermes-amp-track-title", title: sessionTitle(session, index) }, sessionTitle(session, index))
                );
              })
            : e(
                "li",
                { className: "is-empty" },
                e("span", { className: "hermes-amp-track-index" }, "00"),
                e("span", { className: "hermes-amp-track-title" }, data.error || "No recent sessions")
              )
        )
      )
    );
  }

  function FooterRight() {
    return e(
      "div",
      { className: "hermes-amp-footer" },
      e("span", null, "128KBPS AGENT STREAM"),
      e("span", { "aria-hidden": "true" }, " // "),
      e("span", null, "LOCALHOST STEREO")
    );
  }

  function Overlay() {
    return e("div", { className: "hermes-amp-overlay", "aria-hidden": "true" });
  }

  function HeaderBanner() {
    if (window.location.pathname.replace(/\/$/, "") === "/sessions") return null;
    var data = useHermesAmpData();
    var mix = useDataMix()[0];
    return e(
      "div",
      { className: "hermes-amp-header-banner" },
      e(TransportControls, { includeSessions: true }),
      e("div", { className: "hermes-amp-header-banner-title" }, "AGENT STREAM"),
      e(ActivitySpectrum, { data: data, mix: mix, mode: "system", count: 24 }),
      e("div", { className: "hermes-amp-header-banner-copy" }, activitySummary(data, "system", mix))
    );
  }

  function RecentLogLines(props) {
    var logs = props.logs && Array.isArray(props.logs.lines) ? props.logs.lines.slice(-5) : [];
    var lines = logs.length
      ? logs.map(function (line) { return String(line).trim().replace(/^\d{4}-\d{2}-\d{2}\s+/, ""); })
      : [
          "STANDBY: dashboard online",
          "IDLE: waiting for first session",
          "READY: analytics receiver armed"
        ];

    return e(
      "ol",
      { className: "hermes-amp-log-lines" },
      lines.map(function (line, index) {
        return e("li", { key: index }, line);
      })
    );
  }

  function clipText(value, limit) {
    var text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    return text.length > limit ? text.slice(0, limit - 1) + "..." : text;
  }

  function formatSessionAge(session) {
    var value = session && (session.last_active || session.started_at || session.updated_at);
    if (!value) return "UNKNOWN";
    if (SDK.utils && SDK.utils.timeAgo && typeof value === "number") {
      try {
        return SDK.utils.timeAgo(value).toUpperCase();
      } catch (error) {
        return String(value).toUpperCase();
      }
    }
    if (SDK.utils && SDK.utils.isoTimeAgo && typeof value === "string") {
      try {
        return SDK.utils.isoTimeAgo(value).toUpperCase();
      } catch (error2) {
        return String(value).toUpperCase();
      }
    }
    return String(value).toUpperCase();
  }

  function sessionId(session, index) {
    return session && session.id ? String(session.id) : "session-" + index;
  }

  function sessionPreview(session) {
    return clipText(
      session && (
        session.preview ||
        session.summary ||
        session.first_message ||
        session.last_message ||
        session.title
      ),
      150
    );
  }

  function messageText(message) {
    if (!message) return "";
    var raw = message.content || message.text || message.message || message.output || "";
    if (Array.isArray(raw)) {
      raw = raw.map(function (part) {
        return part && (part.text || part.content || part.type || "");
      }).join(" ");
    }
    if (typeof raw === "object") {
      try {
        raw = JSON.stringify(raw);
      } catch (error) {
        raw = String(raw);
      }
    }
    return clipText(raw, 180);
  }

  function SessionInspector(props) {
    var session = props.session || null;
    var _React$useState3 = React.useState(null),
      messages = _React$useState3[0],
      setMessages = _React$useState3[1];
    var _React$useState4 = React.useState(false),
      loading = _React$useState4[0],
      setLoading = _React$useState4[1];
    var _React$useState5 = React.useState(null),
      error = _React$useState5[0],
      setError = _React$useState5[1];
    var id = session && session.id ? String(session.id) : "";

    React.useEffect(function () {
      setMessages(null);
      setError(null);
      setLoading(false);
    }, [id]);

    function refreshHud() {
      window.dispatchEvent(new Event(HERMES_AMP_REFRESH_EVENT));
    }

    function loadTranscript() {
      if (!id || loading) return;
      setLoading(true);
      setError(null);
      var promise = SDK.api && SDK.api.getSessionMessages
        ? SDK.api.getSessionMessages(id)
        : SDK.fetchJSON("/api/sessions/" + encodeURIComponent(id) + "/messages");
      promise
        .then(function (response) {
          setMessages((response && response.messages) || []);
        })
        .catch(function (err) {
          setError(err && err.message ? err.message : "Unable to load transcript");
        })
        .finally(function () {
          setLoading(false);
        });
    }

    function deleteSession() {
      if (!id) return;
      var label = sessionTitle(session, 0);
      if (!window.confirm("Delete session \"" + label + "\"? This cannot be undone.")) return;
      setLoading(true);
      setError(null);
      var promise = SDK.api && SDK.api.deleteSession
        ? SDK.api.deleteSession(id)
        : SDK.fetchJSON("/api/sessions/" + encodeURIComponent(id), { method: "DELETE" });
      promise
        .then(function () {
          setMessages(null);
          refreshHud();
        })
        .catch(function (err) {
          setError(err && err.message ? err.message : "Unable to delete session");
        })
        .finally(function () {
          setLoading(false);
        });
    }

    if (!session) {
      return e(
        "div",
        { className: "hermes-amp-inspector is-empty" },
        e("strong", null, "NO SESSION"),
        e("span", null, "Start a chat to populate the playlist."),
        e("a", { href: "/chat" }, "START CHAT")
      );
    }

    var tokens = sessionTokens(session);
    var details = [
      ["MODEL", readModelLabel(session)],
      ["SRC", session.source || "LOCAL"],
      ["LAST", formatSessionAge(session)],
      ["MSGS", formatCompact(session.message_count)],
      ["TOK", formatCompact(tokens)],
      ["API", formatCompact(session.api_call_count)],
      ["COST", formatCost(sessionCost(session))]
    ];

    return e(
      "div",
      { className: "hermes-amp-inspector" },
      e(SegmentText, { title: sessionTitle(session, 0) }, sessionTitle(session, 0)),
      e("p", null, sessionPreview(session) || "No preview recorded for this session."),
      e(
        "div",
        { className: "hermes-amp-inspector-grid" },
        details.map(function (detail) {
          return e(
            "span",
            { key: detail[0] },
            e("em", null, detail[0]),
            e("strong", null, detail[1])
          );
        })
      ),
      e(
        "div",
        { className: "hermes-amp-inspector-actions" },
        e("a", { href: "/chat?resume=" + encodeURIComponent(id) }, "RESUME"),
        e("button", { type: "button", onClick: loadTranscript }, loading ? "LOAD..." : "VIEW"),
        e("button", { type: "button", onClick: deleteSession, className: "is-danger" }, "DELETE")
      ),
      error ? e("div", { className: "hermes-amp-inspector-error" }, error) : null,
      messages ? e(
        "ol",
        { className: "hermes-amp-transcript" },
        messages.length ? messages.slice(0, 5).map(function (message, index) {
          var role = String(message.role || message.type || "MSG").toUpperCase();
          return e(
            "li",
            { key: message.id || index },
            e("span", null, role),
            e("p", null, messageText(message) || "[empty]")
          );
        }) : e("li", null, e("span", null, "EMPTY"), e("p", null, "No transcript messages returned."))
      ) : null
    );
  }

  function AmpDesktopPage() {
    var data = useHermesAmpData();
    var _useDataMix = useDataMix(),
      mix = _useDataMix[0],
      setMix = _useDataMix[1];
    var sessions = data.sessions || [];
    var meters = signalMeters(data);
    var _React$useState6 = React.useState(null),
      selectedSessionId = _React$useState6[0],
      setSelectedSessionId = _React$useState6[1];
    var selectedSession = sessions.find(function (session, index) {
      return sessionId(session, index) === selectedSessionId;
    }) || sessions[0] || null;
    var nowPlaying = sessions.length ? sessionTitle(sessions[0], 0) : "NO SESSION";
    var sub = sessions.length
      ? activitySummary(data, "sessions", mix)
      : "START CHAT TO PLAY";

    React.useEffect(function () {
      if (!sessions.length) {
        if (selectedSessionId !== null) setSelectedSessionId(null);
        return;
      }
      var hasSelected = sessions.some(function (session, index) {
        return sessionId(session, index) === selectedSessionId;
      });
      if (!hasSelected) setSelectedSessionId(sessionId(sessions[0], 0));
    }, [sessions, selectedSessionId]);

    return e(
      "div",
      { className: "hermes-amp-desktop-page" },
      e(
        "div",
        { className: "hermes-amp-desktop-topline" },
        e("span", null, "HERMES.AMP WORKSPACE"),
        e("span", null, activitySummary(data, "system", mix))
      ),
      e(
        AmpWindow,
        { title: "MAIN PLAYER", className: "is-desktop-main" },
        e(
          "div",
          { className: "hermes-amp-desktop-player" },
          e(DeckReadout, { primary: nowPlaying, secondary: sub }),
          e(ActivitySpectrum, { data: data, mix: mix, mode: "sessions", count: 34 }),
          e(TransportControls, null)
        )
      ),
      e(
        AmpWindow,
        { title: "PLAYLIST", className: "is-desktop-playlist" },
        e(DeckPlaylist, { sessions: sessions, selectedId: selectedSessionId, onSelect: setSelectedSessionId })
      ),
      e(
        AmpWindow,
        { title: "EQUALIZER", className: "is-desktop-eq" },
        e(EqualizerSliders, { mix: mix, onMixChange: setMix })
      ),
      e(
        AmpWindow,
        { title: "SIGNAL METERS", className: "is-desktop-system" },
        e(StatTiles, { data: data }),
        e(
          "div",
          { className: "hermes-amp-meter-stack" },
          meters.map(function (meter) {
            return e(Meter, { key: meter.label, label: meter.label, value: meter.value, title: meter.title, tone: meter.tone });
          })
        )
      ),
      e(
        AmpWindow,
        { title: "LOG TAIL", className: "is-desktop-logs" },
        e(RecentLogLines, { logs: data.logs })
      ),
      e(
        AmpWindow,
        { title: "SESSION INSPECTOR", className: "is-desktop-inspector" },
        e(SessionInspector, { session: selectedSession })
      ),
      e(
        AmpWindow,
        { title: "CRON DECK", className: "is-desktop-cron" },
        e(CronDeck, { data: data })
      )
    );
  }

  function PageBanner(props) {
    var data = useHermesAmpData();
    var mix = useDataMix()[0];
    return e(
      "div",
      { className: "hermes-amp-page-banner" },
      e("div", { className: "hermes-amp-page-banner-title" }, props.title),
      e(ActivitySpectrum, { data: data, mix: mix, mode: props.mode, count: 18 }),
      e("div", { className: "hermes-amp-page-banner-copy" }, activitySummary(data, props.mode, mix))
    );
  }

  function AmpWindow(props) {
    return e(
      "section",
      { className: "hermes-amp-deck-window " + (props.className || "") },
      e(
        "div",
        { className: "hermes-amp-deck-titlebar" },
        e("span", null, props.title),
        e("span", { className: "hermes-amp-window-buttons", "aria-hidden": "true" }, "_ [] X")
      ),
      props.children
    );
  }

  function DeckReadout(props) {
    return e(
      "div",
      { className: "hermes-amp-deck-readout" },
      e(SegmentText, { title: props.primary }, props.primary),
      e("span", null, props.secondary)
    );
  }

  function EqualizerSliders(props) {
    var mix = sanitizeMix(props.mix || defaultMix());
    var onMixChange = props.onMixChange || function () {};

    function setBand(key, value) {
      onMixChange(function (previous) {
        var next = sanitizeMix(previous || mix);
        next[key] = clamp(Math.round(numberOrZero(value)), 0, 200);
        return next;
      });
    }

    function applyPreset(name) {
      onMixChange(MIX_PRESETS[name] || MIX_PRESETS.BAL);
    }

    return e(
      "div",
      { className: "hermes-amp-eq-panel" },
      e(
        "div",
        { className: "hermes-amp-eq-sliders", "aria-label": "Data mixer equalizer" },
        MIX_BANDS.map(function (band) {
          var value = mixValue(mix, band.key);
          return e(
            "label",
            {
              className: "hermes-amp-eq-slider",
              key: band.key,
              title: band.label + " weight " + value + "%",
              style: { "--mix-value": String(value) }
            },
            e("input", {
              className: "hermes-amp-eq-range",
              type: "range",
              min: "0",
              max: "200",
              step: "5",
              value: value,
              "aria-label": band.label + " mixer weight",
              onChange: function (event) { setBand(band.key, event.target.value); }
            }),
            e("span", { className: "hermes-amp-eq-slider-value" }, value),
            e("span", { className: "hermes-amp-eq-slider-label" }, band.label)
          );
        })
      ),
      e(
        "div",
        { className: "hermes-amp-eq-presets", "aria-label": "Mixer presets" },
        ["BAL", "TOK", "OPS", "ERR", "RESET"].map(function (preset) {
          return e(
            "button",
            { key: preset, type: "button", onClick: function () { applyPreset(preset); } },
            preset
          );
        })
      )
    );
  }

  function DeckPlaylist(props) {
    var sessions = props.sessions || [];
	    var tracks = sessions.length
	      ? sessions.slice(0, 6).map(function (session, index) {
	          return {
	            id: sessionId(session, index),
	            title: sessionTitle(session, index),
            meta: formatCompact(numberOrZero(session.message_count)) + " MSG",
            session: session
	          };
	        })
	      : [
	          { id: "idle-1", title: "NO SESSION", meta: "00:00" },
	          { id: "idle-2", title: "START CHAT TO FILL PLAYLIST", meta: "STBY" },
	          { id: "idle-3", title: "TOK CHART PREVIEW ARMED", meta: "MIX" },
	          { id: "idle-4", title: "LOG TAIL BUFFER READY", meta: "LOG" },
	          { id: "idle-5", title: "MODEL SIGNAL WAITING", meta: "MODE" },
	          { id: "idle-6", title: "CACHE METER STANDBY", meta: "CACH" },
	          { id: "idle-7", title: "API COUNTER MUTED", meta: "API" },
	          { id: "idle-8", title: "VECTOR MEMORY IDLE", meta: "MEM" },
	          { id: "idle-9", title: "ROUTER NO SIGNAL", meta: "RTE" },
	          { id: "idle-10", title: "LOCALHOST STEREO", meta: "128K" },
	          { id: "idle-11", title: "SYNC TO REFRESH HUD", meta: "SYNC" }
	        ];

    return e(
      "ol",
      { className: "hermes-amp-deck-playlist" },
      tracks.map(function (track, index) {
        var isActive = props.selectedId && track.id === props.selectedId;
        return e(
          "li",
          { key: track.id, className: isActive ? "is-active" : "" },
          e(
            "button",
            {
              type: "button",
              disabled: !track.session,
              onClick: function () { props.onSelect && track.session && props.onSelect(track.id); },
              "aria-pressed": isActive ? "true" : "false"
            },
            e("span", { className: "hermes-amp-track-index" }, String(index + 1).padStart(2, "0")),
            e("span", { className: "hermes-amp-track-title", title: track.title }, track.title),
            e("span", { className: "hermes-amp-track-meta" }, track.meta)
          )
        );
      })
    );
  }

  function StatTiles(props) {
    var data = props.data || {};
    var totals = analyticsTotals(data);
    var tiles = [
      ["STATUS", readStatusLabel(data.status)],
      ["RUNS", formatCompact(data.sessionTotal || totals.total_sessions || 0)],
      ["TOKENS", formatCompact(totalTokenCount(data))],
      ["COST", formatCost(totals.total_actual_cost || totals.total_estimated_cost)]
    ];
    return e(
      "div",
      { className: "hermes-amp-stat-tiles" },
      tiles.map(function (tile) {
        return e(
          "div",
          { className: "hermes-amp-stat-tile", key: tile[0] },
          e("span", null, tile[0]),
          e("strong", null, tile[1])
        );
      })
    );
  }

  function CronDeck(props) {
    var data = props.data || {};
    var jobs = (data.cronJobs || []).slice().sort(function (a, b) {
      return cronSortScore(a) - cronSortScore(b);
    });
    var summary = cronSummary(jobs);
    var visible = jobs.slice(0, 4);

    return e(
      "div",
      { className: "hermes-amp-cron-panel" },
      e(
        "div",
        { className: "hermes-amp-cron-summary" },
        e("span", null, summary.left),
        e("span", null, summary.right)
      ),
      data.cronError
        ? e("div", { className: "hermes-amp-cron-empty is-error" }, "CRON API ERROR")
        : visible.length
          ? e(
              "ol",
              { className: "hermes-amp-cron-list" },
              visible.map(function (job, index) {
                var signal = cronJobSignal(job);
                var schedule = job.schedule_display || (job.schedule && job.schedule.display) || "NO SCHEDULE";
                return e(
                  "li",
                  { key: job.id || index, title: cronJobTitle(job, index) + " // " + cronDate(job.next_run_at) },
                  e("span", { className: "hermes-amp-cron-badge " + signal.className }, signal.label),
                  e(
                    "span",
                    { className: "hermes-amp-cron-copy" },
                    e("strong", null, cronJobTitle(job, index)),
                    e("em", null, trimText(schedule, 36))
                  ),
                  e("span", { className: "hermes-amp-cron-time" }, cronRelative(job.next_run_at))
                );
              })
            )
          : e("div", { className: "hermes-amp-cron-empty" }, "NO CRON JOBS ARMED"),
      e("a", { className: "hermes-amp-cron-manage", href: "/cron" }, "OPEN CRON")
    );
  }

  function SessionsDeck() {
    var data = useHermesAmpData();
    var _useDataMix2 = useDataMix(),
      mix = _useDataMix2[0],
      setMix = _useDataMix2[1];
    var sessions = data.sessions || [];
    var meters = signalMeters(data);
    var nowPlaying = sessions.length ? sessionTitle(sessions[0], 0) : "NO SESSION";
    var sub = sessions.length
      ? activitySummary(data, "sessions", mix)
      : "START CHAT TO FILL PLAYLIST";

    return e(
      "div",
      { className: "hermes-amp-sessions-deck" },
      e(
        AmpWindow,
        { title: "HERMES.AMP MAIN", className: "is-main-player" },
        e(
          "div",
          { className: "hermes-amp-main-player-grid" },
          e(DeckReadout, { primary: nowPlaying, secondary: sub }),
          e(ActivitySpectrum, { data: data, mix: mix, mode: "sessions", count: 28 }),
          e(TransportControls, null)
        )
      ),
      e(
        AmpWindow,
        { title: "EQUALIZER", className: "is-equalizer" },
        e(EqualizerSliders, { mix: mix, onMixChange: setMix })
      ),
      e(
        AmpWindow,
        { title: "PLAYLIST EDITOR", className: "is-playlist" },
        e(DeckPlaylist, { sessions: sessions })
      ),
      e(
        AmpWindow,
        { title: "SIGNAL METERS", className: "is-meters" },
        e(StatTiles, { data: data }),
        e(
          "div",
          { className: "hermes-amp-meter-stack" },
          meters.map(function (meter) {
            return e(Meter, { key: meter.label, label: meter.label, value: meter.value, title: meter.title, tone: meter.tone });
          })
        )
      ),
      e(
        AmpWindow,
        { title: "CRON DECK", className: "is-cron" },
        e(CronDeck, { data: data })
      )
    );
  }

  registry.register("hermes-amp", AmpDesktopPage);
  registry.registerSlot("hermes-amp", "header-left", HeaderLeft);
  registry.registerSlot("hermes-amp", "header-right", HeaderRight);
  registry.registerSlot("hermes-amp", "pre-main", HeaderBanner);
  registry.registerSlot("hermes-amp", "sidebar", Sidebar);
  registry.registerSlot("hermes-amp", "footer-right", FooterRight);
  registry.registerSlot("hermes-amp", "overlay", Overlay);
  registry.registerSlot("hermes-amp", "logs:top", function LogsBanner() {
    return e(PageBanner, {
      title: "LOG STREAM",
      mode: "logs"
    });
  });
  registry.registerSlot("hermes-amp", "sessions:top", function SessionsBanner() {
    return e(
      React.Fragment,
      null,
      e(PageBanner, {
        title: "SESSION PLAYLIST",
        mode: "sessions"
      }),
      e(SessionsDeck, null)
    );
  });
})();
