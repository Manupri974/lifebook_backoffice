// MODIFIÉ : Ajout compteur de livres réels par interview et alerte multi-livres
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

export default function App() {
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState({});
  const [options, setOptions] = useState({});

  useEffect(() => {
    async function fetchStats() {
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

      const [
        { count: totalLivres },
        { count: todayLivres },
        last,
        queueCounts,
        { count: totalQueue },
        responsesAll,
        previews,
        livres
      ] = await Promise.all([
        supabase.from("livres_generes").select("*", { count: "exact", head: true }),
        supabase.from("livres_generes").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
        supabase.from("livres_generes").select("created_at").order("created_at", { ascending: false }).limit(1),
        Promise.all(
          Array.from({ length: 10 }, (_, i) => i + 1).map(async (h) => {
            const date = new Date(Date.now() - h * 3600 * 1000).toISOString();
            const { count } = await supabase
              .from("generation_queue")
              .select("*", { count: "exact", head: true })
              .eq("status", "pending")
              .lte("created_at", date);
            return { [`+${h}h`]: count };
          })
        ).then(async (arr) => {
          const combined = Object.assign({}, ...arr);
          const { count: lessThan1h } = await supabase
            .from("generation_queue")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending")
            .gt("created_at", new Date(Date.now() - 3600 * 1000).toISOString());
          return { "<1h": lessThan1h, ...combined };
        }),
        supabase.from("generation_queue").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("responses").select("id, created_at, params"),
        supabase.from("preview").select("interview_id"),
        supabase.from("livres_generes").select("interview_id")
      ]);

      const previewSet = new Set(previews.data.map(p => p.interview_id));
      const livreMap = livres.data.reduce((acc, row) => {
        acc[row.interview_id] = (acc[row.interview_id] || 0) + 1;
        return acc;
      }, {});

      const group = {};
      const unique = { type: new Set(), vue: new Set(), format: new Set(), age: new Set(), dest: new Set(), qui: new Set(), enfants: new Set() };

      responsesAll.data.forEach(row => {
        const p = row.params || {};
        const key = JSON.stringify({
          type: p.type ?? "NULL",
          vue: p.vue ?? "NULL",
          format: p.format ?? "NULL",
          age: p.age ?? "NULL",
          dest: p.dest ?? "NULL",
          qui: p.qui ?? "NULL",
          enfants: p.enfants ?? "NULL"
        });

        if (!group[key]) {
          group[key] = {
            total: 0,
            avecPreview: 0,
            avecLivre: 0,
            multiLivres: 0,
            totalLivreCount: 0,
            ...JSON.parse(key)
          };
        }

        const livresAssocies = livreMap[row.id] || 0;

        group[key].total++;
        group[key].totalLivreCount += livresAssocies;
        if (livresAssocies > 1) group[key].multiLivres++;
        if (livresAssocies >= 1) group[key].avecLivre++;
        else if (previewSet.has(row.id)) group[key].avecPreview++;

        Object.keys(unique).forEach(k => unique[k].add(p[k] ?? "NULL"));
      });

      const lignes = Object.values(group);

      const totalGlobal = lignes.reduce((acc, r) => {
        acc.total += r.total;
        acc.preview += r.avecPreview;
        acc.livre += r.avecLivre;
        acc.livreReels += r.totalLivreCount;
        return acc;
      }, { total: 0, preview: 0, livre: 0, livreReels: 0 });

      setStats({
        totalLivres,
        todayLivres,
        totalUsers: "—",
        dernierLivre: last.data?.[0]?.created_at,
        queue: queueCounts,
        totalQueue,
        lignes,
        totalGlobal
      });

      const formattedOptions = {};
      Object.entries(unique).forEach(([key, values]) => {
        formattedOptions[key] = Array.from(values).sort();
      });
      setOptions(formattedOptions);
    }

    fetchStats();
  }, []);
