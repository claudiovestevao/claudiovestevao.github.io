const PARKS = [
  {
    key: "mk",
    name: "Magic Kingdom",
    queueId: 6,
    scheduleId: "75ea578a-adc8-4116-a54d-dccb60765ef9",
    planDate: "2026-08-12"
  },
  {
    key: "epic",
    name: "Epic Universe",
    queueId: 334,
    scheduleId: "12dbb85b-265f-44e6-bccf-f1faa17211fc",
    planDate: "2026-08-17"
  },
  {
    key: "hs",
    name: "Hollywood Studios",
    queueId: 7,
    scheduleId: "288747d1-8b4f-4a64-867e-ea7c9b27bad8",
    planDate: "2026-08-15"
  }
];

const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=28.5383&longitude=-81.3792&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FNew_York&forecast_days=3";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [weather, parks] = await Promise.all([
      fetchJson(WEATHER_URL),
      Promise.all(PARKS.map(loadPark))
    ]);

    return Response.json(
      {
        generatedAt: new Date().toISOString(),
        weather: summarizeWeather(weather),
        parks,
        sources: [
          {
            name: "Open-Meteo",
            url: "https://open-meteo.com/"
          },
          {
            name: "Queue-Times",
            url: "https://queue-times.com/en-US/pages/api"
          },
          {
            name: "ThemeParks.wiki",
            url: "https://api.themeparks.wiki/"
          }
        ]
      },
      {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=600"
        }
      }
    );
  } catch (error) {
    return Response.json(
      {
        generatedAt: new Date().toISOString(),
        error: "Nao foi possivel atualizar os dados ao vivo agora.",
        detail: error instanceof Error ? error.message : String(error)
      },
      { status: 502 }
    );
  }
}

async function loadPark(park) {
  const [queueData, scheduleData] = await Promise.all([
    fetchJson(`https://queue-times.com/en-US/parks/${park.queueId}/queue_times.json`),
    fetchJson(`https://api.themeparks.wiki/v1/entity/${park.scheduleId}/schedule`).catch(() => null)
  ]);

  const rides = [
    ...(Array.isArray(queueData.rides) ? queueData.rides : []),
    ...flattenLands(queueData.lands)
  ];
  const openRides = rides.filter((ride) => ride.is_open === true);
  const waits = openRides
    .map((ride) => Number(ride.wait_time))
    .filter((wait) => Number.isFinite(wait) && wait > 0);
  const sortedWaits = waits.toSorted((a, b) => b - a);
  const avgWait = waits.length ? Math.round(waits.reduce((total, wait) => total + wait, 0) / waits.length) : 0;
  const maxWait = sortedWaits[0] ?? 0;
  const lastUpdated = latestDate(rides.map((ride) => ride.last_updated));
  const schedule = pickSchedule(scheduleData?.schedule, park.planDate);

  return {
    key: park.key,
    name: park.name,
    planDate: park.planDate,
    avgWait,
    maxWait,
    openRides: openRides.length,
    trackedRides: rides.length,
    level: crowdLevel(avgWait, maxWait, openRides.length),
    topWaits: openRides
      .filter((ride) => Number(ride.wait_time) > 0)
      .toSorted((a, b) => Number(b.wait_time) - Number(a.wait_time))
      .slice(0, 5)
      .map((ride) => ({
        name: ride.name,
        wait: Number(ride.wait_time),
        updatedAt: ride.last_updated
      })),
    lastUpdated,
    schedule,
    sourceUrl: `https://queue-times.com/en-US/parks/${park.queueId}`
  };
}

function flattenLands(lands) {
  if (!Array.isArray(lands)) {
    return [];
  }

  return lands.flatMap((land) => (Array.isArray(land.rides) ? land.rides : []));
}

function latestDate(values) {
  const dates = values
    .map((value) => (value ? new Date(value) : null))
    .filter((date) => date && !Number.isNaN(date.getTime()))
    .toSorted((a, b) => b.getTime() - a.getTime());

  return dates[0]?.toISOString() ?? null;
}

function pickSchedule(schedule, planDate) {
  if (!Array.isArray(schedule)) {
    return null;
  }

  const planned = schedule.find((item) => item.date === planDate && item.type === "OPERATING");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const current = schedule.find((item) => item.date === today && item.type === "OPERATING");
  const item = planned ?? current;

  if (!item) {
    return null;
  }

  return {
    date: item.date,
    openingTime: item.openingTime,
    closingTime: item.closingTime,
    type: item.type,
    isPlanDate: item.date === planDate
  };
}

function crowdLevel(avgWait, maxWait, openRides) {
  if (openRides === 0) {
    return {
      label: "Fechado/sem leitura",
      tone: "muted",
      advice: "Use como referencia historica apenas quando o parque estiver aberto."
    };
  }

  if (avgWait >= 45 || maxWait >= 90) {
    return {
      label: "Alta",
      tone: "high",
      advice: "Vale chegar na abertura, priorizar 2-3 atrações e considerar Lightning Lane se o orçamento permitir."
    };
  }

  if (avgWait >= 25 || maxWait >= 60) {
    return {
      label: "Moderada",
      tone: "medium",
      advice: "Boa janela para fazer clássicos cedo e deixar shows/lojas para o calor ou chuva."
    };
  }

  return {
    label: "Baixa",
    tone: "low",
    advice: "Momento bom para encaixar atração curta, foto e pausa com menos pressão."
  };
}

function summarizeWeather(data) {
  const current = data.current ?? {};
  const now = current.time;
  const hourly = data.hourly ?? {};
  const hourlyRows = Array.isArray(hourly.time)
    ? hourly.time.map((time, index) => ({
        time,
        temperature: hourly.temperature_2m?.[index],
        feelsLike: hourly.apparent_temperature?.[index],
        rainChance: hourly.precipitation_probability?.[index],
        code: hourly.weather_code?.[index]
      }))
    : [];
  const nextHours = hourlyRows
    .filter((row) => !now || row.time >= now)
    .slice(0, 8);
  const rainWindow = nextHours.find((row) => Number(row.rainChance) >= 45) ?? null;
  const maxRainNextHours = Math.max(0, ...nextHours.map((row) => Number(row.rainChance) || 0));

  return {
    city: "Orlando, FL",
    timezone: data.timezone ?? "America/New_York",
    current: {
      time: current.time,
      temperature: round(current.temperature_2m),
      feelsLike: round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      rainMm: current.rain,
      precipitationMm: current.precipitation,
      windKmh: round(current.wind_speed_10m),
      code: current.weather_code,
      description: weatherDescription(current.weather_code)
    },
    nextHours,
    maxRainNextHours,
    rainWindow,
    daily: (data.daily?.time ?? []).map((time, index) => ({
      date: time,
      max: round(data.daily?.temperature_2m_max?.[index]),
      min: round(data.daily?.temperature_2m_min?.[index]),
      rainChance: data.daily?.precipitation_probability_max?.[index],
      code: data.daily?.weather_code?.[index],
      description: weatherDescription(data.daily?.weather_code?.[index])
    })),
    advice: weatherAdvice(current, maxRainNextHours)
  };
}

function weatherAdvice(current, maxRainNextHours) {
  const feelsLike = Number(current.apparent_temperature);

  if (feelsLike >= 35) {
    return "Calor forte: parque cedo, pausa longa no hotel e muita agua. Nath e Luiza mandam no ritmo.";
  }

  if (maxRainNextHours >= 60) {
    return "Chuva provavel nas proximas horas: levar poncho, proteger carrinho e trocar fila externa por show/loja.";
  }

  if (maxRainNextHours >= 35) {
    return "Risco de pancada: manter plano flexivel e evitar atravessar Orlando para algo pequeno.";
  }

  return "Janela boa: manter plano normal, mas ainda com pausa de calor no meio da tarde.";
}

function weatherDescription(code) {
  const value = Number(code);

  if ([0].includes(value)) return "Ceu limpo";
  if ([1, 2].includes(value)) return "Poucas nuvens";
  if ([3].includes(value)) return "Nublado";
  if ([45, 48].includes(value)) return "Nevoeiro";
  if ([51, 53, 55, 56, 57].includes(value)) return "Garoa";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return "Chuva";
  if ([95, 96, 99].includes(value)) return "Trovoadas";

  return "Tempo variavel";
}

function round(value) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? Math.round(numeric * 10) / 10 : null;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "claudiocode-orlando-agent/1.0"
    },
    next: {
      revalidate: 300
    }
  });

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  return response.json();
}
