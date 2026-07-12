import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AWESOME_USD_BRL_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL";
const OPEN_ER_USD_URL = "https://open.er-api.com/v6/latest/USD";

export async function GET() {
  const startedAt = new Date().toISOString();
  const attempts = [];
  const quote = await readAwesomeQuote(startedAt, attempts) || await readOpenErQuote(startedAt, attempts);

  if (!quote) {
    return NextResponse.json({
      ok: false,
      generatedAt: startedAt,
      message: attempts.join(" | ") || "Cotacao USD/BRL indisponivel.",
      defaults: shoppingDefaults()
    }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    generatedAt: startedAt,
    quote,
    defaults: shoppingDefaults(),
    attempts,
    sources: [
      {
        name: "AwesomeAPI USD-BRL",
        url: "https://docs.awesomeapi.com.br/api-de-moedas"
      },
      {
        name: "ExchangeRate-API open rates",
        url: "https://www.exchangerate-api.com/docs/free"
      },
      {
        name: "Florida Department of Revenue - Discretionary Sales Surtax",
        url: "https://floridarevenue.com/Forms_library/current/dr15dss_26.pdf"
      },
      {
        name: "Planalto - Decreto 12.499/2025 IOF",
        url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/d12499.htm"
      }
    ]
  }, {
    headers: {
      "Cache-Control": "s-maxage=120, stale-while-revalidate=300"
    }
  });
}

async function readAwesomeQuote(startedAt, attempts) {
  try {
    const response = await fetch(AWESOME_USD_BRL_URL, {
      headers: {
        accept: "application/json"
      },
      next: {
        revalidate: 120
      }
    });

    if (!response.ok) {
      attempts.push(`AwesomeAPI ${response.status}`);
      return null;
    }

    const json = await response.json();
    const raw = json?.USDBRL || {};
    const bid = Number.parseFloat(raw.bid);
    const ask = Number.parseFloat(raw.ask);
    const high = Number.parseFloat(raw.high);
    const low = Number.parseFloat(raw.low);

    if (!Number.isFinite(bid) && !Number.isFinite(ask)) {
      attempts.push("AwesomeAPI sem USD/BRL numerico");
      return null;
    }

    return {
      pair: "USD/BRL",
      bid: Number.isFinite(bid) ? bid : ask,
      ask: Number.isFinite(ask) ? ask : bid,
      high: Number.isFinite(high) ? high : null,
      low: Number.isFinite(low) ? low : null,
      pctChange: Number.parseFloat(raw.pctChange || "0"),
      updatedAt: timestampForQuote(raw, startedAt),
      sourceName: "AwesomeAPI",
      sourceUrl: "https://docs.awesomeapi.com.br/api-de-moedas"
    };
  } catch (error) {
    attempts.push(`AwesomeAPI ${error.message}`);
    return null;
  }
}

async function readOpenErQuote(startedAt, attempts) {
  try {
    const response = await fetch(OPEN_ER_USD_URL, {
      headers: {
        accept: "application/json"
      },
      next: {
        revalidate: 120
      }
    });

    if (!response.ok) {
      attempts.push(`open.er-api ${response.status}`);
      return null;
    }

    const json = await response.json();
    const brl = Number.parseFloat(json?.rates?.BRL);
    if (!Number.isFinite(brl)) {
      attempts.push("open.er-api sem BRL numerico");
      return null;
    }

    const updatedAt = json?.time_last_update_unix
      ? new Date(Number(json.time_last_update_unix) * 1000).toISOString()
      : startedAt;

    return {
      pair: "USD/BRL",
      bid: brl,
      ask: brl,
      high: null,
      low: null,
      pctChange: 0,
      updatedAt,
      sourceName: "ExchangeRate-API",
      sourceUrl: "https://www.exchangerate-api.com/docs/free"
    };
  } catch (error) {
    attempts.push(`open.er-api ${error.message}`);
    return null;
  }
}

function shoppingDefaults() {
  return {
    salesTaxPct: 6.5,
    iofPct: 3.5,
    county: "Orange County / Orlando",
    paymentMethods: [
      {
        id: "cash",
        label: "Dinheiro",
        iofReimbursed: false,
        appliesIof: false
      },
      {
        id: "card",
        label: "Cartao de credito",
        iofReimbursed: false,
        appliesIof: true
      },
      {
        id: "porto",
        label: "Cartao Portobank",
        iofReimbursed: true,
        appliesIof: true
      }
    ]
  };
}

function timestampForQuote(quote, fallback) {
  const timestamp = Number.parseInt(quote.timestamp || "", 10);
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return new Date(timestamp * 1000).toISOString();
  }
  const created = Date.parse(`${quote.create_date || ""} UTC`);
  if (Number.isFinite(created)) {
    return new Date(created).toISOString();
  }
  return fallback;
}
