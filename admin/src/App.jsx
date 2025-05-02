// Lifebook Admin Dashboard Complet avec panneau latéral et compteur livres multiples + chiffres cliquables
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
  const [selectedList, setSelectedList] = useState([]);
  const [panelTitle, setPanelTitle] = useState("");

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
            ids: [],
            ...JSON.parse(key)
          };
        }

        const livresAssocies = livreMap[row.id] || 0;

        group[key].total++;
        group[key].totalLivreCount += livresAssocies;
        group[key].ids.push(row.id);
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

  const openPanel = (title, ids) => {
    setPanelTitle(title);
    setSelectedList(ids);
  };

  const closePanel = () => {
    setPanelTitle("");
    setSelectedList([]);
  };

  const lignesFiltrees = stats?.lignes?.filter(row => {
    return Object.entries(filter).every(([key, value]) => !value || row[key] === value);
  });

  return (
    <>
      {/* ✅ Tableau principal */}
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th>Type</th><th>Vue</th><th>Format</th><th>Age</th><th>Dest</th><th>Qui</th><th>Enfants</th>
            <th>Total</th><th>Preview</th><th>Livre</th><th>Livres réels</th>
          </tr>
        </thead>
        <tbody>
          {lignesFiltrees?.map((row, i) => (
            <tr key={i} className="border-t">
              <td>{row.type}</td>
              <td>{row.vue}</td>
              <td>{row.format}</td>
              <td>{row.age}</td>
              <td>{row.dest}</td>
              <td>{row.qui}</td>
              <td>{row.enfants}</td>
              <td className="text-blue-600 underline cursor-pointer" onClick={() => openPanel("Interviews total", row.ids)}>{row.total}</td>
              <td className="text-blue-600 underline cursor-pointer" onClick={() => openPanel("Avec preview", row.ids.filter((_, idx) => row.avecPreview))}>{row.avecPreview}</td>
              <td className="text-blue-600 underline cursor-pointer" onClick={() => openPanel("Avec livre", row.ids.filter((_, idx) => row.avecLivre))}>{row.avecLivre}</td>
              <td className="text-blue-600 underline cursor-pointer" onClick={() => openPanel("Livres générés", row.ids)}>{row.totalLivreCount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedList.length > 0 && (
        <div className="fixed top-0 right-0 w-full max-w-md h-full bg-white border-l border-gray-300 shadow-xl z-50 overflow-y-auto">
          <div className="p-4 flex justify-between items-center border-b">
            <h3 className="text-lg font-semibold">{panelTitle}</h3>
            <button onClick={closePanel} className="text-gray-500 hover:text-black">✖</button>
          </div>
          <div className="p-4">
            <p className="mb-2 text-sm text-gray-600">{selectedList.length} ID{selectedList.length > 1 ? "s" : ""} :</p>
            <ul className="space-y-1 text-sm">
              {selectedList.map(id => (
                <li key={id} className="bg-gray-100 rounded px-2 py-1 font-mono">{id}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
