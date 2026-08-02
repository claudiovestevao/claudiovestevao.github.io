"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Backpack,
  Baby,
  CheckCircle2,
  Cpu,
  FileText,
  Luggage,
  Pill,
  RotateCcw,
  Shirt,
  ShoppingCart,
  Sparkles
} from "lucide-react";

const STORAGE_KEY = "cc-mala-checklist-v1";

const CATEGORIES = [
  {
    key: "malas",
    icon: Luggage,
    title: "Malas / estratégia enxoval",
    items: [
      { id: "malas-1", text: "2 malas grandes despachadas indo com ~40% de espaço livre" },
      { id: "malas-2", text: "1 mala dobrável vazia dentro da mala (vira 3ª mala na volta)" },
      { id: "malas-3", text: "Não despachar mala vazia demais — distribuir roupas entre elas (mala vazia amassa no porão)" },
      { id: "malas-4", text: "Balança de mala portátil (evitar surpresa no check-in)" },
      { id: "malas-5", text: "Packing cubes vazios pro enxoval" },
      { id: "malas-6", text: "Cadeado TSA nas malas despachadas", suggested: true },
      { id: "malas-7", text: "Etiqueta de identificação (nome, telefone, endereço) em cada mala e mochila", suggested: true }
    ]
  },
  {
    key: "documentos",
    icon: FileText,
    title: "Documentos",
    items: [
      { id: "doc-1", text: "Passaportes (3) + visto/ESTA" },
      { id: "doc-2", text: "Carta do obstetra em inglês liberando o voo (semana gestacional + previsão de parto)" },
      { id: "doc-3", text: "Cartão pré-natal da Nathalie" },
      { id: "doc-4", text: "Seguro viagem com cobertura pra gestante (conferir apólice!)" },
      { id: "doc-5", text: "CNH + CNH internacional (se tiver) pro carro alugado" },
      { id: "doc-6", text: "Certidão de nascimento da Luiza (cópia)" },
      { id: "doc-7", text: "Voucher Epic Universe / ingressos parques no app" },
      { id: "doc-8", text: "Cartões internacionais + dólares em espécie" },
      { id: "doc-9", text: "Cartão Wise da Nathalie" },
      { id: "doc-10", text: "Cópia digital de tudo no Drive" },
      { id: "doc-11", text: "Impressão física das reservas de hotel e do itinerário de voo (backup sem internet/bateria)", suggested: true },
      { id: "doc-12", text: "Confirmar com a companhia aérea o limite de semanas gestacionais para embarque (ida e volta)", suggested: true }
    ]
  },
  {
    key: "claudio",
    icon: Shirt,
    title: "Claudio (mínimo)",
    items: [
      { id: "cl-1", text: "4 camisetas dry-fit" },
      { id: "cl-2", text: "1 camisa/polo (jantares)" },
      { id: "cl-3", text: "2 bermudas" },
      { id: "cl-4", text: "1 calça leve" },
      { id: "cl-5", text: "6 cuecas" },
      { id: "cl-6", text: "6 pares de meias" },
      { id: "cl-7", text: "1 sunga" },
      { id: "cl-8", text: "Tênis confortável (amaciado) + chinelo" },
      { id: "cl-9", text: "Boné" },
      { id: "cl-10", text: "Óculos de sol" },
      { id: "cl-11", text: "Capa de chuva/poncho (já comprado no BR)" },
      { id: "cl-12", text: "1 blusa leve de frio (ar-condicionado/avião)" },
      { id: "cl-13", text: "Pijama" }
    ]
  },
  {
    key: "nathalie",
    icon: Shirt,
    title: "Nathalie (gestante, mínimo)",
    items: [
      { id: "na-1", text: "4 vestidos/looks leves e confortáveis" },
      { id: "na-2", text: "2 shorts/leggings de gestante" },
      { id: "na-3", text: "4 blusas" },
      { id: "na-4", text: "Roupas íntimas p/ 6 dias" },
      { id: "na-5", text: "Biquíni" },
      { id: "na-6", text: "Meias de compressão pro voo (ida e volta)" },
      { id: "na-7", text: "Tênis MUITO confortável + sandália" },
      { id: "na-8", text: "Chapéu/boné" },
      { id: "na-9", text: "Óculos de sol" },
      { id: "na-10", text: "Capa de chuva/poncho (já comprado no BR)" },
      { id: "na-11", text: "1 casaquinho (ar-condicionado)" },
      { id: "na-12", text: "Pijama" },
      { id: "na-13", text: "Almofada de pescoço pro voo" }
    ]
  },
  {
    key: "luiza",
    icon: Baby,
    title: "Luiza (5 anos — margem pra imprevistos)",
    items: [
      { id: "lu-1", text: "7 conjuntos completos (1/dia + folga; criança suja roupa)" },
      { id: "lu-2", text: "2 trocas completas extras SEMPRE na mochila do parque" },
      { id: "lu-3", text: "8 calcinhas + 8 pares de meias" },
      { id: "lu-4", text: "2 pijamas" },
      { id: "lu-5", text: "2 maiôs/biquínis" },
      { id: "lu-6", text: "Boné" },
      { id: "lu-7", text: "Fraldas (noturnas) — quantidade pra 10 noites + folga" },
      { id: "lu-8", text: "2 mamadeiras + escova de lavar + mini detergente" },
      { id: "lu-9", text: "1 lata de leite em pó LACRADA (alfândega dos EUA só aceita alimento industrializado e lacrado; se acabar, o Ninho lá se chama \"Nido\" e tem no Walmart)" },
      { id: "lu-10", text: "Tênis confortável + sandália/crocs" },
      { id: "lu-11", text: "Capa de chuva infantil (já comprada no BR)" },
      { id: "lu-12", text: "Casaquinho (ar dos restaurantes/avião)" },
      { id: "lu-13", text: "Fantasia da Moana (dia do Magic Kingdom — as de lá custam $$$)" },
      { id: "lu-14", text: "Pulseira de segurança com telefone dos pais" },
      { id: "lu-15", text: "Óculos de sol infantil" },
      { id: "lu-16", text: "Almofada de pescoço pro voo" },
      { id: "lu-17", text: "Boneca Luna" },
      { id: "lu-18", text: "Boneca Barbie sereia" },
      { id: "lu-19", text: "Mochilinha dela (dá senso de responsabilidade e leva os brinquedos)" }
    ]
  },
  {
    key: "vitor",
    icon: Shirt,
    title: "Vitor",
    items: [
      { id: "vi-1", text: "5 camisetas" },
      { id: "vi-2", text: "2 bermudas" },
      { id: "vi-3", text: "Roupas íntimas + meias p/ 6 dias" },
      { id: "vi-4", text: "Sunga" },
      { id: "vi-5", text: "Tênis confortável + chinelo" },
      { id: "vi-6", text: "Boné + óculos de sol" },
      { id: "vi-7", text: "Capa de chuva/poncho (já comprado no BR)" },
      { id: "vi-8", text: "Casaquinho" },
      { id: "vi-9", text: "Pijama" },
      { id: "vi-10", text: "Almofada de pescoço pro voo" }
    ]
  },
  {
    key: "farmacia",
    icon: Pill,
    title: "Farmacinha",
    items: [
      { id: "fa-1", text: "Termômetro digital" },
      { id: "fa-2", text: "Antitérmico/analgésico infantil (Luiza) — levar do BR, dosagem conhecida" },
      { id: "fa-3", text: "Antialérgico infantil e adulto" },
      { id: "fa-4", text: "Remédio de enjoo infantil (viagem de carro/avião)" },
      { id: "fa-5", text: "Soro fisiológico + gaze + band-aids" },
      { id: "fa-6", text: "Band-aid de bolha (Compeed) — pés de parque" },
      { id: "fa-7", text: "Pomada pra assadura/atrito" },
      { id: "fa-8", text: "Analgésico adulto (o que a Nathalie pode: SÓ o que o obstetra liberou)" },
      { id: "fa-9", text: "Remédio de azia liberado pelo obstetra (comum na gravidez)" },
      { id: "fa-10", text: "Vitaminas do pré-natal (quantidade pra 11 dias + folga)" },
      { id: "fa-11", text: "Repelente (versão gestante-safe e infantil)" },
      { id: "fa-12", text: "Protetor solar rosto (o de corpo compra no Walmart lá)" },
      { id: "fa-13", text: "Receitas médicas dos remédios de uso contínuo (alfândega)" },
      { id: "fa-14", text: "Creme de mão + protetor labial (ar do avião e dos parques resseca muito)" }
    ]
  },
  {
    key: "eletronicos",
    icon: Cpu,
    title: "Eletrônicos",
    items: [
      { id: "el-1", text: "Adaptadores de tomada BR→EUA (3 un)" },
      { id: "el-2", text: "Power bank grande (app do parque mata bateria)" },
      { id: "el-3", text: "Carregadores + cabos extras" },
      { id: "el-4", text: "Tablet da Luiza carregado + fone infantil (voo de 9h!)" },
      { id: "el-5", text: "Chip internacional/eSIM ativado antes de embarcar" }
    ]
  },
  {
    key: "maodemao",
    icon: Backpack,
    title: "Bagagem de mão (voo ~9h com crianças)",
    items: [
      { id: "bm-1", text: "Documentos + carta do obstetra + remédios essenciais (NUNCA despachar)" },
      { id: "bm-2", text: "Troca de roupa completa pra cada um (extravio/acidentes)" },
      { id: "bm-3", text: "Fralda extra da Luiza + lenços umedecidos" },
      { id: "bm-4", text: "1 mamadeira + leite em pó já dosado em potinho (voo de 9h; peça água morna à tripulação)" },
      { id: "bm-5", text: "Ziploc transparente pros líquidos (máx. 100 ml cada na cabine)" },
      { id: "bm-6", text: "Itens de valor (eletrônicos, joias, dinheiro, cartões) SEMPRE na mão, nunca despachar" },
      { id: "bm-7", text: "Almofadas de pescoço: Nathalie, Luiza e Vitor" },
      { id: "bm-8", text: "Casaquinhos (avião gelado)" },
      { id: "bm-9", text: "Snacks: Luiza e Vitor (voo + primeiros dias)" },
      { id: "bm-10", text: "Garrafinhas vazias (encher após a segurança)" },
      { id: "bm-11", text: "Escova/pasta de dente + higiene mini + álcool gel" },
      { id: "bm-12", text: "Meias de compressão da Nathalie (vestir antes do embarque)" },
      { id: "bm-13", text: "Brinquedos/entretenimento do avião" },
      { id: "bm-14", text: "Tablet da Luiza carregado + fone infantil" },
      { id: "bm-15", text: "Tablet/jogos do Vitor + fone" },
      { id: "bm-16", text: "Boneca Luna (a Barbie sereia vai na mala — 1 boneca por voo basta)" },
      { id: "bm-17", text: "1 brinquedo pequeno NOVO pra Luiza (surpresa na decolagem — rende horas)" },
      { id: "bm-18", text: "Kit desenho: lápis de cor, caderninho, adesivos" },
      { id: "bm-19", text: "Cartas UNO ou similar (Vitor + família)" },
      { id: "bm-20", text: "Livrinho de atividades da Luiza" },
      { id: "bm-21", text: "Power bank (recarregar tablets no voo)" },
      { id: "bm-22", text: "Máscara de dormir + protetor auricular (adultos, voo de 9h)", suggested: true }
    ]
  },
  {
    key: "jacomprado",
    icon: CheckCircle2,
    title: "Já comprado no BR (só não esquecer de pôr na mala)",
    items: [
      { id: "ja-1", text: "Ponchos/capas de chuva de todos" },
      { id: "ja-2", text: "Guarda-chuva" }
    ]
  }
];

const NAO_LEVAR = [
  "Protetor solar de corpo",
  "Ventilador portátil",
  "Eletrólitos",
  "Snacks de parque"
];

export default function PackingChecklist() {
  const [checked, setChecked] = useState({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      setChecked(saved && typeof saved === "object" ? saved : {});
    } catch {
      setChecked({});
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  }, [checked, hydrated]);

  const totals = useMemo(() => {
    const allItems = CATEGORIES.flatMap((category) => category.items);
    const done = allItems.filter((item) => checked[item.id]).length;
    return { done, total: allItems.length };
  }, [checked]);

  function toggle(id) {
    setChecked((current) => ({ ...current, [id]: !current[id] }));
  }

  function resetAll() {
    if (window.confirm("Desmarcar todos os itens da checklist?")) setChecked({});
  }

  const progressPercent = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;

  return (
    <div className="packing-checklist">
      <section className="packing-intro">
        <div>
          <span className="ui-badge">Orlando 09–19/ago</span>
          <h1>Checklist de Mala</h1>
          <p>
            Estratégia: mínimo de roupa (compras lá + lavanderia dia 13/8), voltar com espaço pro enxoval do Arthur.
          </p>
          <p className="packing-travelers">Viajantes: Claudio, Nathalie (gestante), Luiza (5) e Vitor.</p>
        </div>
        <div className="packing-progress" role="status" aria-live="polite">
          <div className="packing-progress-ring" style={{ "--pct": `${progressPercent}%` }}>
            <span>{progressPercent}%</span>
          </div>
          <div>
            <b>{totals.done} de {totals.total}</b>
            <small>itens prontos</small>
          </div>
          <button onClick={resetAll} type="button">
            <RotateCcw size={14} />
            Recomeçar
          </button>
        </div>
      </section>

      {CATEGORIES.map((category) => {
        const categoryDone = category.items.filter((item) => checked[item.id]).length;
        const Icon = category.icon;
        return (
          <section className="packing-category" key={category.key}>
            <div className="packing-category-head">
              <Icon size={18} aria-hidden="true" />
              <h2>{category.title}</h2>
              <span>{categoryDone}/{category.items.length}</span>
            </div>
            <ul className="packing-item-list">
              {category.items.map((item) => (
                <li className={checked[item.id] ? "is-checked" : ""} key={item.id}>
                  <label>
                    <input
                      checked={Boolean(checked[item.id])}
                      onChange={() => toggle(item.id)}
                      type="checkbox"
                    />
                    <span>
                      {item.text}
                      {item.suggested ? <em className="packing-suggested"><Sparkles size={11} /> sugestão</em> : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="packing-category packing-nao-levar">
        <div className="packing-category-head">
          <ShoppingCart size={18} aria-hidden="true" />
          <h2>Não levar (comprar no Walmart dia 10/8)</h2>
        </div>
        <p className="packing-footnote">
          <AlertCircle size={14} /> Fica mais barato e mais leve comprar por lá: {NAO_LEVAR.join(", ").toLowerCase()}.
        </p>
      </section>
    </div>
  );
}
