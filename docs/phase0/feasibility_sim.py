"""Phase 0 実現可能性シミュレーション（設計検証用。製品コードではありません）

・質問データは「架空の合成データ」です。実在の作品・発売年・普及率は一切使っていません。
・目的: 推理アルゴリズム（ベイズ更新＋頑健化＋校正）の挙動、必要質問数、確信度の校正を確認すること。
・ここで得られる誤差の値は、実データでの精度予測ではありません（合成データは現実より単純なため楽観的）。

使い方:
  python3 feasibility_sim.py <seed> <質問数> <mild|harsh> <各生年の仮想回答者数>          # 素朴ベイズ vs 頑健化
  python3 feasibility_sim.py <seed> <質問数> <mild|harsh> <人数> latent                   # ジャンル関心度の潜在変数
  python3 feasibility_sim.py <seed> <質問数> <mild|harsh> <人数> conv                     # 文化的生年ずれの畳み込み（校正）
"""
import numpy as np, sys, json
rng = np.random.default_rng(int(sys.argv[1]) if len(sys.argv) > 1 else 1)
REF = 2026
B = np.arange(REF - 90, REF - 9)            # candidate birth years 1936..2016
T = np.arange(1925, 2031)                   # calendar years
def sig(x): return 1 / (1 + np.exp(-x))
K_SMOOTH = 0.7

def overlap_years(s, e, a0, a1, b):
    b = np.asarray(b, float)[:, None]
    active = sig((T - s) / K_SMOOTH) * sig((e - T) / K_SMOOTH)
    inwin = sig((T - (b + a0)) / K_SMOOTH) * sig(((b + a1) - T) / K_SMOOTH)
    return (active * inwin).sum(1)

WINDOWS = {"kid": (6, 12), "teen": (12, 18), "young": (18, 30), "adult": (25, 55)}

def make_item(kind):
    if kind == "exp":
        s = rng.uniform(1950, 2022)
        d = rng.choice([2, 3, 5, 8, 15, 25])
        w = rng.choice(list(WINDOWS))
        return dict(kind="exp", s=s, e=min(s + d, REF), win=WINDOWS[w],
                    ceil=rng.uniform(0.3, 0.9), aw_floor=rng.uniform(0.03, 0.5))
    else:  # era choice: 4 adjacent periods
        s0 = rng.uniform(1955, 2008); L = rng.uniform(4, 8)
        periods = [(s0 + i * L, s0 + (i + 1) * L + 1.5) for i in range(4)]
        w = rng.choice(["kid", "teen"])
        return dict(kind="era", periods=periods, win=WINDOWS[w], ceil=rng.uniform(0.5, 0.9))

def probs(it, b, shift=0.0, ceil_mult=1.0):
    """P(option | birth year b). Options: exp -> [heavy, light, aware_only, unaware]; era -> 4 periods + none"""
    a0, a1 = it["win"]
    if it["kind"] == "exp":
        s, e = it["s"] + shift, it["e"] + shift
        g = 1 - np.exp(-overlap_years(s, e, a0, a1, b) / 1.5)
        gaw = 1 - np.exp(-overlap_years(s, e, a0 - 3, a1 + 25, b) / 1.0)
        c = np.clip(it["ceil"] * ceil_mult, 0.05, 0.95)
        pexp = 0.02 + (c - 0.02) * g
        paw = np.maximum(it["aw_floor"] + (0.97 - it["aw_floor"]) * gaw, pexp / 0.98)
        h = 0.2 + 0.5 * g
        P = np.stack([pexp * h, pexp * (1 - h), paw - pexp, 1 - paw])
    else:
        ov = np.stack([overlap_years(ps + shift, pe + shift, a0, a1, b) for ps, pe in it["periods"]])
        c = np.clip(it["ceil"] * ceil_mult, 0.05, 0.95)
        w = 0.03 + c * (1 - np.exp(-ov / 1.5))
        none = 0.15 + 1.0 * np.exp(-ov.sum(0))
        P = np.vstack([w, none[None]])
        P = P / P.sum(0)
    return P

def entropy(p): p = p[p > 0]; return -(p * np.log2(p)).sum()

CONV_SD = 0.0
def conv(post):
    if CONV_SD <= 0: return post
    k = np.exp(-0.5 * (np.arange(-8, 9) / CONV_SD) ** 2); k /= k.sum()
    p = np.convolve(post, k, mode="same"); return p / p.sum()
def hdi(post, mass=0.8):
    post = conv(post)
    order = np.argsort(-post); c = np.cumsum(post[order]); idx = order[: np.searchsorted(c, mass) + 1]
    return B[idx].min(), B[idx].max()

def run(bank, cfg, n_players_per_year=4, perturb=True):
    LAPSE, TAU, MINQ, MAXQ, WIDTH, EIGMIN = cfg["lapse"], cfg["tau"], cfg["minq"], cfg["maxq"], cfg["width"], cfg["eigmin"]
    Lmodel = []
    for it in bank:
        P = probs(it, B); K = P.shape[0]
        Lmodel.append((1 - LAPSE) * P + LAPSE / K)
    res = []
    for b_true in B:
        for _ in range(n_players_per_year):
            delta = rng.normal(0, DELTA_SD) if perturb else 0.0       # person-level cultural offset
            interest = np.clip(rng.lognormal(0, INTEREST_SD, 12), 0.15, 1.6)  # person x genre interest
            logp = np.zeros(len(B)); asked = set(); n = 0
            while True:
                post = np.exp(logp - logp.max()); post /= post.sum()
                lo, hi = hdi(post)
                best, best_q = -1, None
                H0 = entropy(post)
                for qi, L in enumerate(Lmodel):
                    if qi in asked: continue
                    pa = L @ post
                    eh = sum(pa[a] * entropy((L[a] * post) / pa[a]) for a in range(L.shape[0]))
                    g = H0 - eh
                    if g > best: best, best_q = g, qi
                if n >= MAXQ or best_q is None or (n >= MINQ and ((hi - lo + 1) <= WIDTH or best < EIGMIN)):
                    break
                it = bank[best_q]; asked.add(best_q); n += 1
                # respondent answer from perturbed truth
                if rng.random() < 0.05:   # "覚えていない" -> no update
                    continue
                if perturb:
                    shift = rng.normal(0, 1.5) if "_shift" not in it else it["_shift"]
                    Pt = probs(it, [b_true + delta], shift=it["_shift"], ceil_mult=it["_cm"] * interest[it["genre"]])[:, 0]
                    if rng.random() < LAPSE_TRUE: Pt = np.ones_like(Pt) / len(Pt)
                else:
                    Pt = probs(it, [b_true])[:, 0]
                a = rng.choice(len(Pt), p=Pt / Pt.sum())
                logp += TAU * np.log(Lmodel[best_q][a])
            post = np.exp(logp - logp.max()); post /= post.sum()
            cdf = np.cumsum(conv(post)); med = B[np.searchsorted(cdf, 0.5)]
            lo, hi = hdi(post)
            res.append(dict(true=int(b_true), est=int(med), lo=int(lo), hi=int(hi), n=n))
    return res

def summarize(res, label):
    err = np.array([abs(r["est"] - r["true"]) for r in res]); n = np.array([r["n"] for r in res])
    cover = np.mean([r["lo"] <= r["true"] <= r["hi"] for r in res])
    width = np.array([r["hi"] - r["lo"] + 1 for r in res])
    high = width <= 3
    hw = np.mean(err[high] > 2) if high.any() else float("nan")
    out = {"label": label, "MAE": round(err.mean(), 2), "median_err": float(np.median(err)),
           "within2": round(np.mean(err <= 2), 2), "within5": round(np.mean(err <= 5), 2),
           "HDI80_cover": round(cover, 2), "mean_width": round(width.mean(), 1),
           "high_conf_share": round(high.mean(), 2), "high_conf_err>2": round(hw, 2),
           "avgQ": round(n.mean(), 1), "maxQ": int(n.max())}
    by = {}
    for dec in range(1930, 2020, 10):
        m = np.array([dec <= r["true"] < dec + 10 for r in res])
        if m.any(): by[f"{dec}s"] = (round(err[m].mean(), 1), round(np.mean([res[i]["lo"] <= res[i]["true"] <= res[i]["hi"] for i in np.where(m)[0]]), 2))
    out["by_decade(MAE,cover)"] = by
    print(json.dumps(out, ensure_ascii=False))

def make_bank(n):
    bank = [make_item("era" if rng.random() < 0.3 else "exp") for _ in range(n)]
    for it in bank:   # hidden "truth" perturbation: data error in dates and penetration
        it["_shift"] = rng.normal(0, SHIFT_SD); it["_cm"] = rng.uniform(0.75, 1.25)
        it["genre"] = int(rng.integers(0, 12))
    return bank

SHIFT_SD, DELTA_SD, INTEREST_SD, LAPSE_TRUE = 1.5, 1.0, 0.0, 0.07
if __name__ == "__main__" and "latent" not in sys.argv and "conv" not in sys.argv:
    nb = int(sys.argv[2]) if len(sys.argv) > 2 else 50
    scen = sys.argv[3] if len(sys.argv) > 3 else "mild"
    if scen == "harsh":
        SHIFT_SD, DELTA_SD, INTEREST_SD, LAPSE_TRUE = 2.5, 2.0, 0.6, 0.10
    bank = make_bank(nb)
    npl = int(sys.argv[4]) if len(sys.argv) > 4 else 3
    cfgs = {
      "naive(lapse0,tau1)": dict(lapse=0.0001, tau=1.0, minq=10, maxq=25, width=3, eigmin=0.05),
      "robust(lapse.08,tau.8)": dict(lapse=0.08, tau=0.8, minq=10, maxq=25, width=3, eigmin=0.05),
      "robust(lapse.12,tau.6)": dict(lapse=0.12, tau=0.6, minq=10, maxq=25, width=3, eigmin=0.05),
    }
    for k, c in cfgs.items():
        summarize(run(bank, c, npl), f"bank{nb} {scen} {k}")

# ---- variant: latent per-genre interest level (marginalized) ----
U_LEVELS = np.array([0.35, 0.7, 1.0]); U_PRIOR = np.log(np.array([0.25, 0.35, 0.40]))
def run_latent(bank, cfg, n_players_per_year=3):
    LAPSE, TAU, MINQ, MAXQ, WIDTH, EIGMIN = cfg["lapse"], cfg["tau"], cfg["minq"], cfg["maxq"], cfg["width"], cfg["eigmin"]
    Lm = []
    for it in bank:
        Ls = []
        for u in U_LEVELS:
            P = probs(it, B, ceil_mult=u); K = P.shape[0]; Ls.append((1 - LAPSE) * P + LAPSE / K)
        Lm.append(np.stack(Ls))          # (U, K, nB)
    res = []
    for b_true in B:
        for _ in range(n_players_per_year):
            delta = rng.normal(0, DELTA_SD)
            interest = np.clip(rng.lognormal(0, INTEREST_SD, 12), 0.15, 1.6)
            LL = np.zeros((12, len(U_LEVELS), len(B))); asked = set(); n = 0
            def logpost():
                z = U_PRIOR[None, :, None] + TAU * LL
                m = z.max(1, keepdims=True); return (m[:, 0] + np.log(np.exp(z - m).sum(1))).sum(0)
            while True:
                lp = logpost(); post = np.exp(lp - lp.max()); post /= post.sum()
                lo, hi = hdi(post); H0 = entropy(post); best, best_q = -1, None
                for qi, L in enumerate(Lm):
                    if qi in asked: continue
                    g = bank[qi]["genre"]; z = U_PRIOR[:, None] + TAU * LL[g]; w = np.exp(z - z.max(0)); w /= w.sum(0)
                    Le = (w[:, None, :] * L).sum(0)
                    pa = Le @ post
                    eh = sum(pa[a] * entropy((Le[a] * post) / pa[a]) for a in range(Le.shape[0]))
                    if H0 - eh > best: best, best_q = H0 - eh, qi
                if n >= MAXQ or best_q is None or (n >= MINQ and ((hi - lo + 1) <= WIDTH or best < EIGMIN)): break
                it = bank[best_q]; asked.add(best_q); n += 1
                if rng.random() < 0.05: continue
                Pt = probs(it, [b_true + delta], shift=it["_shift"], ceil_mult=it["_cm"] * interest[it["genre"]])[:, 0]
                if rng.random() < LAPSE_TRUE: Pt = np.ones_like(Pt) / len(Pt)
                a = rng.choice(len(Pt), p=Pt / Pt.sum())
                LL[it["genre"]] += np.log(Lm[best_q][:, a, :])
            lp = logpost(); post = np.exp(lp - lp.max()); post /= post.sum()
            med = B[np.searchsorted(np.cumsum(post), 0.5)]; lo, hi = hdi(post)
            res.append(dict(true=int(b_true), est=int(med), lo=int(lo), hi=int(hi), n=n))
    return res

def main_latent():
    global SHIFT_SD, DELTA_SD, INTEREST_SD, LAPSE_TRUE
    nb = int(sys.argv[2]); scen = sys.argv[3]
    if scen == "harsh": SHIFT_SD, DELTA_SD, INTEREST_SD, LAPSE_TRUE = 2.5, 2.0, 0.6, 0.10
    bank = make_bank(nb)
    for tau, w in [(0.8, 3), (0.6, 3), (0.6, 5)]:
        c = dict(lapse=0.08, tau=tau, minq=10, maxq=25, width=w, eigmin=0.05)
        summarize(run_latent(bank, c, int(sys.argv[4])), f"bank{nb} {scen} LATENT lapse.08 tau{tau} stopW{w}")
if __name__ == "__main__" and "latent" in sys.argv: main_latent()

def main_conv():
    global SHIFT_SD, DELTA_SD, INTEREST_SD, LAPSE_TRUE, CONV_SD
    nb = int(sys.argv[2]); scen = sys.argv[3]
    if scen == "harsh": SHIFT_SD, DELTA_SD, INTEREST_SD, LAPSE_TRUE = 2.5, 2.0, 0.6, 0.10
    bank = make_bank(nb)
    for sd, w in [(1.5, 5), (2.0, 6)]:
        CONV_SD = sd
        c = dict(lapse=0.08, tau=0.8, minq=10, maxq=25, width=w, eigmin=0.05)
        res = run(bank, c, int(sys.argv[4]))
        summarize(res, f"bank{nb} {scen} robust+conv{sd} stopW{w}")
        width = np.array([r["hi"] - r["lo"] + 1 for r in res]); err = np.array([abs(r["est"] - r["true"]) for r in res])
        for lo_, hi_ in [(0, 5), (6, 8), (9, 99)]:
            m = (width >= lo_) & (width <= hi_)
            if m.any(): print(f"   width {lo_}-{hi_}: share {m.mean():.2f}  MAE {err[m].mean():.2f}  err>3 {np.mean(err[m] > 3):.2f}  cover {np.mean([res[i]['lo'] <= res[i]['true'] <= res[i]['hi'] for i in np.where(m)[0]]):.2f}")
if __name__ == "__main__" and "conv" in sys.argv: main_conv()
