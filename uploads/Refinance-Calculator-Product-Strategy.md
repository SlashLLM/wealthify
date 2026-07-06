# Wealthify Refinance Calculator — Product Strategy Plan

**The brief in one line:** build the refinance calculator that converts ~90% of users into named, contactable leads — by giving them a result so valuable and so personal that handing over an email and phone feels like the obvious next step, not a toll gate.

**Status:** Strategy + v1 build (standalone, embeddable). NZ market, June 2026 data.
**Owner:** Wealthify (FAP-licensed mortgage adviser).
**Companion file:** `Wealthify-Refinance-Calculator.html` (the working calculator).

---

## 1. The strategic bet

The proposal already identifies the Refinance Savings Snapshot as *"the highest-intent magnet — people who run this are ready to move."* That is correct, and it changes how we should think about the calculator.

A first-home borrowing-power tool captures people 6–18 months out. A refinance calculator captures people who already own a home, already have a mortgage, and are one good reason away from switching. The intent is hotter, the deal size is real today, and the adviser's commission is bankable now. So this tool deserves the most conversion engineering of any tool on the site.

The competitive landscape (from the proposal): **Squirrel** has refinance-savings calculators backed by 1,500+ reviews; **Sentinel Wealth** funnels every polished tool to "Book a free call." Both are good. Neither does the two things we will: (1) show a credible, bank-specific dollar number *before* the gate, and (2) end in *both* an instant personalised report *and* a booking — the value exchange most NZ tools skip.

**Our edge:** Most NZ refinance tools either ask for your details first (friction, low completion) or give a vague answer with no path to act. We give the real number instantly, then make the email/phone the only way to get the *full* picture and a human to confirm it.

---

## 2. Why 90% is achievable (the conversion thesis)

90% of *calculator finishers* converting to a lead is aggressive but reachable **if we define the funnel correctly** and engineer each stage. The number that matters is **finisher → lead**, not visitor → lead. We optimise both, but the 90% target lives at the bottom.

The mechanism is four behavioural levers stacked:

1. **Earned value before the ask (reciprocity).** The user sees a real, animated savings figure — "You could save **$38,400** over your loan" — *before* any form. We have already given them something. Asking for contact details after giving value converts far better than gating up front.

2. **The curiosity gap (Zeigarnik effect).** The on-screen number is the headline. The *breakdown* — which banks, how much cashback, your new repayment, your break-even date, the year-by-year interest saved — is blurred/locked behind one step. People do not abandon a result they can already see 80% of. They finish it.

3. **Sunk-cost / endowment.** By the time we ask for email + phone, the user has entered their loan balance, rate and term. They have invested effort and the result feels like *theirs*. Walking away means abandoning a personalised answer they built.

4. **Loss framing + urgency, honestly.** "Every month on your current rate is costing you ~$320." Refinancers are loss-averse; quantified, ongoing loss is more motivating than abstract savings. Paired with the genuine NZ reality that cashback offers and rates move, this creates real, non-manufactured urgency.

**Friction controls that protect the 90%:**

- Only two fields gate the report: **email + mobile**. Name is optional/after. Every extra field measurably drops completion.
- The CTA is reframed as a gift, not a gate: **"Email me my full refinance report"** — not "Submit" or "Get access."
- A single, explicit trust line under the form: *"No spam. One report, then a quick call only if you want it. Your details stay with Wealthify."*
- Inline validation, mobile-numeric keyboards, autofill-friendly fields, no login, no password.
- The booking step comes *after* the report is delivered — we never make a calendar the price of the number.

**Realistic benchmark:** a well-built "value-first, reveal-gated" tool in financial services typically converts 35–60% of finishers. 90% is the north star; we instrument everything (see §8) and A/B our way toward it. The architecture below is built to make 90% physically possible rather than capped by design.

---

## 3. Who is using this (the three refinance personas)

| Persona | Situation | What they fear | What unlocks them |
|---|---|---|---|
| **The Rollover** | Fixed term expiring in the next 30–90 days | "Am I about to be auto-rolled onto a rubbish rate?" | A clear "switch vs stay" number with near-zero break cost — they can act now |
| **The Rate-Shocked** | Came off a low fixed rate, repayments jumped | "Did I overpay? Can I claw any of it back?" | Seeing the monthly bleed quantified + a concrete lower repayment |
| **The Cashback Hunter** | Knows banks pay you to switch, wants the math | "Is the cashback worth the break fee and hassle?" | Net-benefit number: cashback minus break fee minus legals = real gain |

The calculator must speak to all three without making any of them do extra work. We do this by asking for the *minimum* (balance, current rate, remaining term) and making everything else (break fee, fixed expiry, current repayment) optional with smart defaults.

---

## 4. The value equation (why this tool wins)

Built on the same value equation the proposal uses — maximise dream outcome × perceived likelihood, minimise time × effort:

- **Dream outcome:** "Save tens of thousands and pay your home off years sooner." Shown as a big dollar number + years-saved, not a percentage.
- **Perceived likelihood:** Real June-2026 NZ bank rates, transparent assumptions, FAP-licensed adviser, "estimates only" honesty. Credibility *is* conversion in finance.
- **Time delay:** Instant on-screen result (< 2 seconds of typing). Full PDF report in the inbox in ~60 seconds.
- **Effort & sacrifice:** Three inputs, sliders + numeric, mobile-first, plain English. We translate bank-speak (break fee, clawback, LVR) inline.

---

## 5. The screen-by-screen flow

**Stage 0 — Hook (above the fold).** Headline tied to the live moment: *"See how much you could save by refinancing your mortgage — in 30 seconds."* Sub-line with trust: *"Real NZ bank rates. No login. Estimate only — confirmed by a licensed Wealthify adviser."* Social proof chip (reviews / Kiwis helped).

**Stage 1 — Inputs (the calculator).** Three required inputs with sensible NZ defaults:
- Loan balance remaining (slider + field, default ~$500k)
- Your current interest rate (default ~6.5%, the rate-shock zone)
- Years left on your loan (default 25)
- *Optional, progressively revealed:* current fixed rate expiry, estimated break fee, current repayment.

As the user moves a slider, the result animates live. **No gate yet.**

**Stage 2 — The teaser result (the "wow", ungated).** A bold result card:
- "You could save **$XX,XXX** in interest over your loan."
- "That's about **$XXX/month** back in your pocket."
- "Plus up to **$X,XXX cashback** for switching."
- A blurred preview of the detailed breakdown beneath it with a lock icon.

**Stage 3 — The reveal gate (the conversion moment).** One compact card:
- "Get your full personalised Refinance Report" — lists exactly what's inside (bank-by-bank comparison, year-by-year interest saved, break-even date, net benefit after costs, your action plan).
- Email + mobile fields. One button: **"Email me my full report."**
- Trust line + FAP disclosure.

**Stage 4 — The report + booking (the close).** On submit:
- Unlock the full breakdown on screen *immediately* (instant gratification — they don't wait for email).
- "Your report is on its way to {email}."
- Then the soft, high-value booking CTA: *"Want a Wealthify adviser to confirm your exact numbers and handle the switch for free? Pick a time."* → embedded calendar.

This ordering is deliberate: **value → bigger value teased → contact for full value → full value delivered → human.** The booking is the upsell, never the toll.

---

## 6. The math (credible, defensible, NZ-specific)

The whole strategy collapses if the number is wrong or feels made up. Logic baked into v1:

- **Amortisation:** standard reducing-balance monthly amortisation for both current and new scenarios. Interest-saved = total interest (current rate, remaining term) − total interest (new rate, same term).
- **New rate default:** pulled toward the best-available competitive fixed rate (June 2026: ~4.65% 1yr / ~4.49% 6mo). Editable.
- **Cashback:** modelled at ~0.9% of loan (typical NZ; range 0.85–1.25%), capped (~$20k), with a plain-English note on **pro-rata clawback over 3–4 years** if they leave early.
- **Costs netted out:** legal/solicitor (~$1,200 default) and an optional **break-fee** input (near-zero at rollover; otherwise estimated via the standard NZ approximation: balance × rate-differential × remaining years). **Net benefit = interest saved + cashback − break fee − legal.**
- **Honesty as strategy:** every figure labelled "estimate." A wrong-but-confident number destroys trust and the FAP licence; an honest estimate that an adviser confirms *is* the funnel.

All assumptions are transparent and editable — transparency raises perceived likelihood, which raises conversion.

---

## 7. Brand, UI & craft (why it looks world-class)

Anchored to Wealthify's existing system from the proposal:

- **Palette:** Midnight Navy `#0B1F3A` (trust), Growth Green `#16C172` (money/go), Teal `#0FB5BA`, Premium Gold `#E8B04B` (the savings/cashback highlight), Cloud `#F6F8FB`.
- **Personality:** "Trustworthy like a bank, warm like a mate who's good with money" — and a nod to the luxury-minimal logo direction (restraint, generous whitespace, no clutter).
- **Craft signals that read as "expensive":** smooth count-up animations on the dollar figure, soft depth/shadow, a real-feeling result card, micro-interactions on sliders, a tasteful blurred-lock on the gated section, and a confident, uncluttered layout.
- **Mobile-first:** majority of use is on a phone — large tap targets, numeric keyboards, thumb-reachable CTA, no horizontal scroll.
- **Accessibility:** WCAG-aware contrast, labelled inputs, keyboard operable.

---

## 8. Measurement (how we drive toward 90%)

Instrument the funnel as discrete events so we know exactly where drop-off is and can A/B fix it:

1. `tool_view` → 2. `input_started` → 3. `result_shown` (teaser) → 4. `gate_viewed` → 5. `lead_submitted` → 6. `report_viewed` → 7. `booking_started` → 8. `booking_completed`.

**Primary KPI:** `lead_submitted / result_shown` (the 90% target).
**Guardrails:** finisher rate (`result_shown / input_started`), booking rate, lead→consult→client downstream.

**A/B backlog to chase 90%:** gate copy ("full report" vs "see which banks"), loss-framing line on/off, two fields vs one-then-one, blurred-preview intensity, cashback prominence, urgency line wording, button colour (green vs gold).

---

## 9. Compliance (non-negotiable, NZ)

- Persistent **"Estimate only — not financial advice"** disclaimer; results confirmed by a licensed adviser.
- Operate under Wealthify's **FAP licence**; advisers named/disclosed on booking.
- **CCCFA-aware**, opt-in capture; clear consent language on the form; privacy line ("details stay with Wealthify").
- Cashback/clawback explained honestly so no one feels misled — protects the brand and the licence.

---

## 10. Build plan & roadmap

**v1 (this delivery):** Standalone, self-contained `Wealthify-Refinance-Calculator.html` — full flow (inputs → teaser → gate → report + booking placeholder), brand-aligned, mobile-first, real NZ math. Drop-in or iframe-embeddable; portable to React/Next later.

**v1.1 (wiring):** Connect form to CRM (lead tagged `refinance`, intent score high); connect booking to adviser calendar; trigger the PDF/email report; fire analytics events.

**v2 (compounding):** Live rate feed so numbers are always current; SEO landing wrapper for "refinance calculator NZ"; share mechanic ("I could save $38k — what about you?"); tie into the unified Wealth Score.

**Definition of done for v1:** loads fast on mobile, math verified, teaser lands before the gate, two-field capture, instant on-screen report on submit, booking CTA present, disclaimers shown.

---

*Estimates only, not financial advice. Wealthify operates under its NZ Financial Advice Provider (FAP) licence. Figures reflect June 2026 market data and should be confirmed with a licensed adviser.*
