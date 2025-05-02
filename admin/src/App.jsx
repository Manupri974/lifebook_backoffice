// MODIFIÉ : Vision tableau avec colonnes paramétriques conservée, mais synthétique par combinaison
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

export default function App() {
  const [stats, setStats] = useState(null);

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
      const livreSet = new Set(livres.data.map(l => l.interview_id));

      const group = {};
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
            ...JSON.parse(key)
          };
        }

        group[key].total++;
        if (livreSet.has(row.id)) group[key].avecLivre++;
        else if (previewSet.has(row.id)) group[key].avecPreview++;
      });

      const lignes = Object.values(group);

      setStats({
        totalLivres,
        todayLivres,
        totalUsers: "—",
        dernierLivre: last.data?.[0]?.created_at,
        queue: queueCounts,
        totalQueue,
        lignes
      });
    }

    fetchStats();
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-800 text-white p-4 space-y-4">
        <h1 className="text-xl font-bold">📘 LifeBook Admin</h1>
        <nav className="space-y-2">
          <a href="#" className="block hover:text-purple-300">Dashboard</a>
          <a href="#" className="block hover:text-purple-300">Utilisateurs</a>
          <a href="#" className="block hover:text-purple-300">File d'attente</a>
          <a href="#" className="block hover:text-purple-300">API & Logs</a>
        </nav>
      </aside>

      <main className="flex-1 bg-gray-50 p-6">
        <h2 className="text-2xl font-semibold mb-6">📊 Statistiques générales</h2>

        {stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white p-4 rounded shadow">📘 Total livres : <strong>{stats.totalLivres}</strong></div>
              <div className="bg-white p-4 rounded shadow">👥 Utilisateurs : <strong>{stats.totalUsers}</strong></div>
              <div className="bg-white p-4 rounded shadow">📅 Aujourd’hui : <strong>{stats.todayLivres}</strong></div>
              <div className="bg-white p-4 rounded shadow">🕒 Dernier livre : <strong>{new Date(stats.dernierLivre).toLocaleString()}</strong></div>
              <div className="bg-white p-4 rounded shadow">
                ⏱️ File d’attente totale : <strong>{stats.totalQueue}</strong>
                <ul className="mt-2 text-sm">
                  {Object.entries(stats.queue).map(([h, c]) => (
                    <li key={h}>{h} : {c}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-white p-4 rounded shadow">
              📄 Répartition des interviews par paramètres : ({stats.lignes.length} variantes)
              <div className="overflow-x-auto">
                <table className="w-full mt-4 text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-2 py-1">Type</th>
                      <th className="px-2 py-1">Vue</th>
                      <th className="px-2 py-1">Format</th>
                      <th className="px-2 py-1">Age</th>
                      <th className="px-2 py-1">Dest</th>
                      <th className="px-2 py-1">Qui</th>
                      <th className="px-2 py-1">Enfants</th>
                      <th className="px-2 py-1">Total</th>
                      <th className="px-2 py-1">Avec preview</th>
                      <th className="px-2 py-1">Avec livre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.lignes.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-2 py-1">{row.type}</td>
                        <td className="px-2 py-1">{row.vue}</td>
                        <td className="px-2 py-1">{row.format}</td>
                        <td className="px-2 py-1">{row.age}</td>
                        <td className="px-2 py-1">{row.dest}</td>
                        <td className="px-2 py-1">{row.qui}</td>
                        <td className="px-2 py-1">{row.enfants}</td>
                        <td className="px-2 py-1">{row.total}</td>
                        <td className="px-2 py-1">{row.avecPreview}</td>
                        <td className="px-2 py-1">{row.avecLivre}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
